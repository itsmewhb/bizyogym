import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { sendMembershipExpirationEmail } from "../utils/emailService";
import { useAuth } from "../context/AuthContext";
import "./MembershipExpiration.css";

function MembershipExpiration() {
  const { isAdmin, userProfile } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [search, setSearch] = useState("");

  /*
   * Load members
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "members"),
      (snapshot) => {
        const membersData = snapshot.docs.map(
          (memberDoc) => ({
            id: memberDoc.id,
            ...memberDoc.data(),
          }),
        );

        setMembers(membersData);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error loading members:",
          error,
        );

        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Convert Firestore date/string to Date
   */
  const getExpirationDate = (member) => {
    if (!member.membershipExpirationDate) {
      return null;
    }

    if (
      member.membershipExpirationDate?.toDate
    ) {
      return member.membershipExpirationDate.toDate();
    }

    if (
      typeof member.membershipExpirationDate ===
      "string"
    ) {
      const date = new Date(
        `${member.membershipExpirationDate}T23:59:59`,
      );

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    return null;
  };

  /*
   * Calculate days remaining
   */
  const getDaysRemaining = (member) => {
    const expirationDate =
      getExpirationDate(member);

    if (!expirationDate) {
      return null;
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const expiration = new Date(
      expirationDate,
    );

    expiration.setHours(0, 0, 0, 0);

    const difference =
      expiration.getTime() -
      today.getTime();

    return Math.ceil(
      difference /
        (1000 * 60 * 60 * 24),
    );
  };

  /*
   * Get membership status
   */
  const getExpirationStatus = (member) => {
    const daysRemaining =
      getDaysRemaining(member);

    if (daysRemaining === null) {
      return "No Expiration Date";
    }

    if (daysRemaining < 0) {
      return "Expired";
    }

    if (daysRemaining <= 7) {
      return "Expiring Soon";
    }

    return "Active";
  };

  /*
   * Format date
   */
  const formatDate = (member) => {
    const expirationDate =
      getExpirationDate(member);

    if (!expirationDate) {
      return "-";
    }

    return expirationDate.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    );
  };

  /*
   * Send expiration reminder
   * Admin and Staff are both allowed
   */
  const handleSendReminder = async (
    member,
  ) => {
    // Only Admin and Staff can send reminders
    if (
      !isAdmin &&
      userProfile?.role !== "staff"
    ) {
      alert(
        "You do not have permission to send expiration reminders.",
      );

      return;
    }

    if (!member.email) {
      alert(
        "This member does not have an email address.",
      );

      return;
    }

    const daysRemaining =
      getDaysRemaining(member);

    if (
      daysRemaining === null ||
      daysRemaining < 0
    ) {
      alert(
        "This membership has already expired.",
      );

      return;
    }

    if (daysRemaining > 7) {
      alert(
        "This member is not within the 7-day expiration window yet.",
      );

      return;
    }

    /*
     * Prevent accidental duplicate sending
     * on the same day.
     */
    const lastSent =
      member.lastExpirationReminderSent?.toDate?.();

    if (lastSent) {
      const today = new Date();

      const sameDay =
        lastSent.getFullYear() ===
          today.getFullYear() &&
        lastSent.getMonth() ===
          today.getMonth() &&
        lastSent.getDate() ===
          today.getDate();

      if (sameDay) {
        const sendAgain = window.confirm(
          "A reminder was already sent to this member today. Send another email?",
        );

        if (!sendAgain) {
          return;
        }
      }
    }

    setSendingEmail(member.id);

    try {
      const result =
        await sendMembershipExpirationEmail({
          toName: member.name,
          toEmail: member.email,
          membership:
            member.membershipName ||
            member.membership ||
            "Membership",
          expirationDate:
            formatDate(member),
          daysRemaining,
        });

      if (!result.success) {
        alert(
          "Failed to send expiration email. Please check your EmailJS configuration.",
        );

        return;
      }

      /*
       * Save the last sent date
       */
      await updateDoc(
        doc(db, "members", member.id),
        {
          lastExpirationReminderSent:
            serverTimestamp(),
        },
      );

      alert(
        `Expiration reminder sent to ${member.email}.`,
      );
    } catch (error) {
      console.error(
        "Error sending reminder:",
        error,
      );

      alert(
        "Something went wrong while sending the email.",
      );
    } finally {
      setSendingEmail(null);
    }
  };

  /*
   * Members expiring within 7 days
   */
  const expiringMembers = members.filter(
    (member) => {
      const daysRemaining =
        getDaysRemaining(member);

      return (
        daysRemaining !== null &&
        daysRemaining >= 0 &&
        daysRemaining <= 7
      );
    },
  );

  /*
   * Expired members
   */
  const expiredMembers = members.filter(
    (member) =>
      getExpirationStatus(member) ===
      "Expired",
  );

  /*
   * Active memberships
   */
  const activeMembers = members.filter(
    (member) => {
      const daysRemaining =
        getDaysRemaining(member);

      return (
        daysRemaining !== null &&
        daysRemaining > 7
      );
    },
  );

  /*
   * Search
   */
  const filteredMembers =
    expiringMembers.filter((member) => {
      const searchText =
        search.toLowerCase();

      return (
        (member.name || "")
          .toLowerCase()
          .includes(searchText) ||
        (member.email || "")
          .toLowerCase()
          .includes(searchText) ||
        (
          member.membershipName ||
          member.membership ||
          ""
        )
          .toLowerCase()
          .includes(searchText)
      );
    });

  return (
    <div className="membership-expiration-page">
      {/* HEADER */}
      <div className="membership-expiration-header">
        <div>
          <h1>
            Membership Expiration
          </h1>

          <p>
            Monitor memberships that are
            expiring soon and send renewal
            reminders.
          </p>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="expiration-summary">
        <div className="expiration-summary-card">
          <span>
            Expiring Soon
          </span>

          <strong>
            {expiringMembers.length}
          </strong>

          <small>
            Within 7 days
          </small>
        </div>

        <div className="expiration-summary-card">
          <span>
            Active Memberships
          </span>

          <strong>
            {activeMembers.length}
          </strong>

          <small>
            More than 7 days remaining
          </small>
        </div>

        <div className="expiration-summary-card">
          <span>
            Expired
          </span>

          <strong>
            {expiredMembers.length}
          </strong>

          <small>
            Membership already expired
          </small>
        </div>
      </div>

      {/* EXPIRING LIST */}
      <div className="expiration-card">
        <div className="expiration-card-header">
          <div>
            <h2>
              Expiring Soon
            </h2>

            <p>
              Members whose membership
              expires within 7 days.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="expiration-message">
            Loading memberships...
          </p>
        ) : filteredMembers.length ===
          0 ? (
          <p className="expiration-message">
            No memberships are expiring
            within 7 days.
          </p>
        ) : (
          <div className="expiration-table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Membership</th>
                  <th>Expiration Date</th>
                  <th>Days Remaining</th>
                  <th>Status</th>
                  <th>Reminder</th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.map(
                  (member) => {
                    const daysRemaining =
                      getDaysRemaining(
                        member,
                      );

                    const lastSent =
                      member.lastExpirationReminderSent?.toDate?.();

                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="expiration-member">
                            <div className="expiration-avatar">
                              {member.name
                                ?.charAt(
                                  0,
                                )
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {member.name}
                              </strong>

                              <span>
                                {member.email ||
                                  "No email"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {member.membershipName ||
                            member.membership ||
                            "-"}
                        </td>

                        <td>
                          {formatDate(
                            member,
                          )}
                        </td>

                        <td>
                          <span
                            className={`days-remaining ${
                              daysRemaining <=
                              3
                                ? "urgent"
                                : "warning"
                            }`}
                          >
                            {daysRemaining ===
                            0
                              ? "Expires today"
                              : `${daysRemaining} day${
                                  daysRemaining !==
                                  1
                                    ? "s"
                                    : ""
                                }`}
                          </span>
                        </td>

                        <td>
                          <span className="expiration-status">
                            Expiring Soon
                          </span>
                        </td>

                        <td>
                          <div className="reminder-cell">
                            <button
                              className="send-reminder-btn"
                              onClick={() =>
                                handleSendReminder(
                                  member,
                                )
                              }
                              disabled={
                                sendingEmail ===
                                member.id
                              }
                            >
                              {sendingEmail ===
                              member.id
                                ? "Sending..."
                                : "Send Reminder"}
                            </button>

                            {lastSent && (
                              <small>
                                Sent{" "}
                                {lastSent.toLocaleDateString(
                                  "en-PH",
                                )}
                              </small>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MembershipExpiration;