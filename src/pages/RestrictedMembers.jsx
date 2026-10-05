import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./RestrictedMembers.css";

function RestrictedMembers() {
  const { isAdmin } = useAuth();

  const [members, setMembers] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);

  const [selectedMember, setSelectedMember] = useState(null);

  const [restrictionReason, setRestrictionReason] = useState("");

  const [restrictionUntil, setRestrictionUntil] = useState("");

  /*
   * Load Members
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "members"),
      (snapshot) => {
        const membersData = snapshot.docs.map((memberDoc) => ({
          id: memberDoc.id,
          ...memberDoc.data(),
        }));

        membersData.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );

        setMembers(membersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading members:", error);

        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Load Incidents
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "incidents"),
      (snapshot) => {
        const incidentsData = snapshot.docs.map((incidentDoc) => ({
          id: incidentDoc.id,
          ...incidentDoc.data(),
        }));

        setIncidents(incidentsData);
        setIncidentsLoading(false);
      },
      (error) => {
        console.error("Error loading incidents:", error);

        setIncidentsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Get incidents belonging to a member
   */
  const getMemberIncidents = (memberId) => {
    return incidents.filter(
      (incident) => incident.memberId === memberId,
    );
  };

  /*
   * Get incident count
   */
  const getIncidentCount = (memberId) => {
    return getMemberIncidents(memberId).length;
  };

  /*
   * Open Restrict Modal
   * Admin only
   */
  const openRestrictModal = (member) => {
    if (!isAdmin) return;

    setSelectedMember(member);

    setRestrictionReason("");

    setRestrictionUntil("");

    setShowModal(true);
  };

  /*
   * Close Restrict Modal
   */
  const closeModal = () => {
    setShowModal(false);

    setSelectedMember(null);

    setRestrictionReason("");

    setRestrictionUntil("");
  };

  /*
   * Restrict Member
   * Admin only
   */
  const handleRestrict = async (e) => {
    e.preventDefault();

    if (!isAdmin) return;

    if (!selectedMember) {
      return;
    }

    /*
     * Double-check that the member
     * still has incident history.
     */
    const memberIncidents = getMemberIncidents(selectedMember.id);

    if (memberIncidents.length === 0) {
      alert(
        "This member cannot be restricted because they have no incident history.",
      );

      closeModal();

      return;
    }

    if (!restrictionReason.trim()) {
      alert("Please enter a restriction reason.");

      return;
    }

    try {
      await updateDoc(doc(db, "members", selectedMember.id), {
        isRestricted: true,
        restrictionReason: restrictionReason.trim(),
        restrictionDate: serverTimestamp(),
        restrictionUntil: restrictionUntil || null,
      });

      alert(`${selectedMember.name} has been restricted.`);

      closeModal();
    } catch (error) {
      console.error("Error restricting member:", error);

      alert("Failed to restrict member.");
    }
  };

  /*
   * Remove Restriction
   * Admin only
   */
  const handleRemoveRestriction = async (member) => {
    if (!isAdmin) return;

    const confirmRemove = window.confirm(
      `Remove the restriction from ${member.name}?`,
    );

    if (!confirmRemove) {
      return;
    }

    try {
      await updateDoc(doc(db, "members", member.id), {
        isRestricted: false,
        restrictionReason: "",
        restrictionDate: null,
        restrictionUntil: null,
      });

      alert(`Restriction removed from ${member.name}.`);
    } catch (error) {
      console.error("Error removing restriction:", error);

      alert("Failed to remove restriction.");
    }
  };

  /*
   * Only members with incident history
   * can be selected for restriction.
   */
  const eligibleMembers = members.filter(
    (member) =>
      !member.isRestricted &&
      getIncidentCount(member.id) > 0,
  );

  /*
   * Currently restricted members
   */
  const restrictedMembers = members.filter(
    (member) => member.isRestricted === true,
  );

  /*
   * Search restricted members
   */
  const filteredRestrictedMembers = restrictedMembers.filter((member) => {
    const searchText = search.toLowerCase();

    return (
      (member.name || "").toLowerCase().includes(searchText) ||
      (member.email || "").toLowerCase().includes(searchText) ||
      (member.phone || "").toLowerCase().includes(searchText) ||
      (member.restrictionReason || "")
        .toLowerCase()
        .includes(searchText)
    );
  });

  /*
   * Format restriction date
   */
  const formatRestrictionDate = (timestamp) => {
    if (!timestamp?.toDate) {
      return "-";
    }

    return timestamp.toDate().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /*
   * Format restriction until date
   */
  const formatRestrictionUntil = (date) => {
    if (!date) {
      return "No end date";
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="restricted-members-page">
      {/* Header */}
      <div className="restricted-members-header">
        <div>
          <h1>Restricted Members</h1>

          <p>
            Manage members who have been restricted because of incidents.
          </p>
        </div>

        {/* ADMIN ONLY */}
        {isAdmin && (
          <button
            className="restrict-member-btn"
            onClick={() => {
              if (eligibleMembers.length === 0) {
                alert(
                  "There are no members with incident history available for restriction.",
                );

                return;
              }

              setSelectedMember(null);
              setRestrictionReason("");
              setRestrictionUntil("");
              setShowModal(true);
            }}
          >
            + Restrict Member
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="restriction-summary">
        <div className="restriction-summary-card">
          <span>Restricted Members</span>

          <strong>{restrictedMembers.length}</strong>
        </div>

        <div className="restriction-summary-card">
          <span>Members With Incidents</span>

          <strong>
            {
              members.filter(
                (member) =>
                  getIncidentCount(member.id) > 0,
              ).length
            }
          </strong>
        </div>
      </div>

      {/* Main Card */}
      <div className="restricted-members-card">
        <div className="restricted-card-header">
          <div>
            <h2>Restricted Member List</h2>

            <p>Members currently restricted from gym entry.</p>
          </div>

          <input
            type="text"
            placeholder="Search restricted members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading || incidentsLoading ? (
          <p className="restriction-message">
            Loading restricted members...
          </p>
        ) : filteredRestrictedMembers.length === 0 ? (
          <p className="restriction-message">
            No restricted members found.
          </p>
        ) : (
          <div className="restricted-table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Contact</th>
                  <th>Incidents</th>
                  <th>Reason</th>
                  <th>Restricted Since</th>
                  <th>Until</th>

                  {/* Admin only */}
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {filteredRestrictedMembers.map((member) => {
                  const memberIncidents =
                    getMemberIncidents(member.id);

                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="restricted-member-name">
                          <div className="restricted-avatar">
                            {member.name
                              ?.charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>{member.name}</strong>

                            <span>
                              {member.email || "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>{member.phone || "-"}</td>

                      <td>
                        <span className="incident-count">
                          {memberIncidents.length}{" "}
                          {memberIncidents.length === 1
                            ? "Incident"
                            : "Incidents"}
                        </span>
                      </td>

                      <td>
                        <span className="restriction-reason">
                          {member.restrictionReason || "-"}
                        </span>
                      </td>

                      <td>
                        {formatRestrictionDate(
                          member.restrictionDate,
                        )}
                      </td>

                      <td>
                        {member.restrictionUntil
                          ? formatRestrictionUntil(
                              member.restrictionUntil,
                            )
                          : "No end date"}
                      </td>

                      {/* ADMIN ONLY */}
                      {isAdmin && (
                        <td>
                          <button
                            className="remove-restriction-btn"
                            onClick={() =>
                              handleRemoveRestriction(member)
                            }
                          >
                            Unrestrict
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESTRICT MEMBER MODAL - ADMIN ONLY */}
      {isAdmin && showModal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >
          <div
            className="restriction-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Restrict Member</h2>

                <p>
                  Only members with incident history can be
                  restricted.
                </p>
              </div>

              <button
                className="close-btn"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRestrict}>
              {/* Member Selection */}
              <div className="form-group">
                <label>Member</label>

                <select
                  value={selectedMember?.id || ""}
                  onChange={(e) => {
                    const member = eligibleMembers.find(
                      (item) => item.id === e.target.value,
                    );

                    setSelectedMember(
                      member || null,
                    );
                  }}
                  required
                >
                  <option value="">
                    Select member
                  </option>

                  {eligibleMembers.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name} —{" "}
                      {getIncidentCount(member.id)}{" "}
                      {getIncidentCount(member.id) === 1
                        ? "incident"
                        : "incidents"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Member Incident History */}
              {selectedMember && (
                <div className="incident-history">
                  <div className="incident-history-header">
                    <div>
                      <h3>Incident History</h3>

                      <p>
                        {selectedMember.name} has{" "}
                        {getIncidentCount(
                          selectedMember.id,
                        )}{" "}
                        recorded{" "}
                        {getIncidentCount(
                          selectedMember.id,
                        ) === 1
                          ? "incident"
                          : "incidents"}
                        .
                      </p>
                    </div>
                  </div>

                  <div className="incident-history-list">
                    {getMemberIncidents(
                      selectedMember.id,
                    ).map((incident) => (
                      <div
                        className="incident-history-item"
                        key={incident.id}
                      >
                        <div className="incident-history-title">
                          <strong>
                            {incident.title ||
                              "Untitled Incident"}
                          </strong>

                          <span
                            className={`incident-severity ${(
                              incident.severity || ""
                            )
                              .toLowerCase()
                              .replace(
                                /\s+/g,
                                "-",
                              )}`}
                          >
                            {incident.severity ||
                              "Unknown"}
                          </span>
                        </div>

                        <div className="incident-history-details">
                          <span>
                            Type:{" "}
                            {incident.type || "-"}
                          </span>

                          <span>
                            Date:{" "}
                            {incident.date || "-"}
                          </span>

                          <span>
                            Status:{" "}
                            {incident.status || "-"}
                          </span>
                        </div>

                        {incident.description && (
                          <p>
                            {incident.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Restriction Reason */}
              <div className="form-group">
                <label>Restriction Reason</label>

                <textarea
                  value={restrictionReason}
                  onChange={(e) =>
                    setRestrictionReason(
                      e.target.value,
                    )
                  }
                  placeholder="Enter reason for restricting this member..."
                  rows="4"
                  required
                />
              </div>

              {/* Restriction Until */}
              <div className="form-group">
                <label>Restriction Until</label>

                <input
                  type="date"
                  value={restrictionUntil}
                  onChange={(e) =>
                    setRestrictionUntil(
                      e.target.value,
                    )
                  }
                />

                <small>
                  Leave empty for an indefinite
                  restriction.
                </small>
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={!selectedMember}
                >
                  Restrict Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RestrictedMembers;