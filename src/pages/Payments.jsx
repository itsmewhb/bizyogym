import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../utils/activityLogger";
import "./Payments.css";

function Payments() {
  const { isAdmin } = useAuth();

  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const [formData, setFormData] = useState({
    memberId: "",
    amount: "",
    paymentDate: "",
    paymentMethod: "Cash",
    membership: "",
    notes: "",
  });

  /*
   * Load Payments
   */
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "payments"),
      (snapshot) => {
        const paymentsData = snapshot.docs.map(
          (paymentDoc) => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
          }),
        );

        paymentsData.sort((a, b) => {
          const dateA =
            a.createdAt?.toDate?.() || new Date(0);

          const dateB =
            b.createdAt?.toDate?.() || new Date(0);

          return dateB - dateA;
        });

        setPayments(paymentsData);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error loading payments:",
          error,
        );

        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Load Members
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

        membersData.sort((a, b) =>
          (a.name || "").localeCompare(
            b.name || "",
          ),
        );

        setMembers(membersData);
        setMembersLoading(false);
      },
      (error) => {
        console.error(
          "Error loading members:",
          error,
        );

        setMembersLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Get selected member
   */
  const getSelectedMember = () => {
    return members.find(
      (member) =>
        member.id === formData.memberId,
    );
  };

  /*
   * Calculate total amount already paid
   * by a member.
   *
   * If editing a payment, exclude the
   * current payment from the calculation.
   */
  const getMemberTotalPaid = (
    memberId,
    excludePaymentId = null,
    cycleNumber = null,
  ) => {
    return payments.reduce((total, payment) => {
      if (payment.memberId !== memberId || payment.id === excludePaymentId) {
        return total;
      }

      // Existing payment records without cycleNumber belong to the first cycle.
      const paymentCycle = Number(payment.cycleNumber || 1);

      if (cycleNumber !== null && paymentCycle !== Number(cycleNumber)) {
        return total;
      }

      return total + Number(payment.amount || 0);
    }, 0);
  };

  const getCurrentCycleNumber = (member) => {
    if (!member) return 1;
    return Math.max(Number(member.membershipCycle || 1), 1);
  };

  const isMembershipExpired = (member) => {
    if (!member?.membershipExpirationDate) return false;

    const expirationDate = new Date(
      `${member.membershipExpirationDate}T23:59:59`,
    );

    return !Number.isNaN(expirationDate.getTime()) &&
      new Date() > expirationDate;
  };

  /*
   * Get membership price
   */
  const getMembershipPrice = (member) => {
    return Number(
      member?.membershipPrice || 0,
    );
  };

  /*
   * Calculate membership expiration date from the
   * date the member becomes fully paid.
   */
  const calculateExpirationDate = (startDate, duration) => {
    if (!startDate || !duration) return null;

    const date = new Date(`${startDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) return null;

    date.setDate(date.getDate() + Number(duration));

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  /*
   * Start or reset a member's membership based on
   * their current total payment.
   *
   * Membership starts only when the member is fully paid.
   */
  const syncMemberMembership = async (
    member,
    totalPaid,
    paymentDate,
    cycleNumber,
  ) => {
    if (!member) return;

    const membershipPrice = getMembershipPrice(member);
    const isFullyPaid = membershipPrice > 0 && totalPaid >= membershipPrice;

    // Do not let an older payment cycle overwrite the current membership cycle.
    if (
      member.membershipCycle &&
      Number(cycleNumber) < Number(member.membershipCycle)
    ) {
      return;
    }

    const memberRef = doc(db, "members", member.id);

    if (isFullyPaid) {
      const startDate =
        member.membershipStartDate &&
          Number(member.membershipCycle || 1) === Number(cycleNumber)
          ? member.membershipStartDate
          : paymentDate || new Date().toISOString().split("T")[0];

      const expirationDate = calculateExpirationDate(
        startDate,
        member.membershipDuration,
      );

      await updateDoc(memberRef, {
        membershipCycle: Number(cycleNumber),
        membershipStartDate: startDate,
        membershipExpirationDate: expirationDate,
        status: "Active",
      });

      return;
    }

    // A partial payment must not activate the membership.
    await updateDoc(memberRef, {
      membershipCycle: Number(cycleNumber),
      membershipStartDate: null,
      membershipExpirationDate: null,
      status: "Inactive",
    });
  };

  /*
   * Get payment status.
   * A membership requires one full payment equal to the plan price.
   */
  const getPaymentStatus = (memberId) => {
    const member = members.find(
      (item) => item.id === memberId,
    );

    if (!member) {
      return {
        price: 0,
        paid: 0,
        remaining: 0,
        status: "No Payment",
      };
    }

    const price = getMembershipPrice(member);
    const cycleNumber = getCurrentCycleNumber(member);
    const paid = getMemberTotalPaid(
      memberId,
      null,
      cycleNumber,
    );
    const remaining = Math.max(price - paid, 0);

    return {
      price,
      paid,
      remaining,
      status: paid === price && price > 0 ? "Fully Paid" : "No Payment",
    };
  };

  /*
   * Handle Form Changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "memberId") {
      const selectedMember = members.find(
        (member) => member.id === value,
      );

      setFormData((previous) => ({
        ...previous,
        memberId: value,
        amount: selectedMember
          ? String(getMembershipPrice(selectedMember))
          : "",
        membership:
          selectedMember?.membershipName || "",
      }));

      return;
    }

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
   * Open Add Payment Modal
   */
  const openAddPaymentModal = () => {
    setEditingPayment(null);

    setFormData({
      memberId: "",
      amount: "",
      paymentDate: new Date()
        .toISOString()
        .split("T")[0],
      paymentMethod: "Cash",
      membership: "",
      notes: "",
    });

    setShowModal(true);
  };

  /*
   * Open Edit Payment Modal
   */
  const handleEditClick = (payment) => {
    if (!isAdmin) return;
    setEditingPayment(payment);

    const paymentMember = members.find(
      (member) => member.id === payment.memberId,
    );

    setFormData({
      memberId: payment.memberId || "",
      amount: paymentMember
        ? String(getMembershipPrice(paymentMember))
        : String(payment.amount || ""),
      paymentDate: payment.paymentDate || "",
      paymentMethod:
        payment.paymentMethod || "Cash",
      membership: payment.membership || "",
      notes: payment.notes || "",
    });

    setShowModal(true);
  };

  /*
   * Add Payment
   */
  const handleAddPayment = async (e) => {
    e.preventDefault();

    if (!formData.memberId) {
      alert("Please select a member.");
      return;
    }

    try {
      const selectedMember =
        getSelectedMember();

      if (!selectedMember) {
        alert(
          "Selected member was not found.",
        );
        return;
      }

      const membershipPrice = getMembershipPrice(selectedMember);

      if (membershipPrice <= 0) {
        alert("This member does not have a valid membership plan price.");
        return;
      }

      const existingStatus = getPaymentStatus(selectedMember.id);

      if (existingStatus.status === "Fully Paid" && !isMembershipExpired(selectedMember)) {
        alert("This member already has a fully paid active membership.");
        return;
      }

      // Expired memberships start a new payment cycle.
      const cycleNumber = isMembershipExpired(selectedMember)
        ? getCurrentCycleNumber(selectedMember) + 1
        : getCurrentCycleNumber(selectedMember);

      const exactAmount = membershipPrice;

      const newPaymentRef = await addDoc(
        collection(db, "payments"),
        {
          memberId: selectedMember.id,
          memberName: selectedMember.name,
          amount: exactAmount,
          paymentType: cycleNumber > 1 ? "Renewal" : "Initial",
          cycleNumber,
          paymentDate:
            formData.paymentDate,
          paymentMethod:
            formData.paymentMethod,
          membership:
            selectedMember.membershipName ||
            "",
          membershipPrice: Number(selectedMember.membershipPrice || 0),
          membershipDuration: Number(selectedMember.membershipDuration || 0),
          membershipId: selectedMember.membershipId || null,
          notes: formData.notes.trim(),
          createdAt: serverTimestamp(),
        },
      );

      await syncMemberMembership(
        selectedMember,
        membershipPrice,
        formData.paymentDate,
        cycleNumber,
      );

      const paymentStatus = "Fully Paid";

      await logActivity({
        action: "Payment Added",
        description: `Added payment of ₱${membershipPrice.toLocaleString()} for ${selectedMember.name
          } - ${paymentStatus}`,
        targetType: "payment",
        targetId: newPaymentRef.id,
      });

      alert("Payment added successfully!");

      closeModal();
    } catch (error) {
      console.error(
        "Error adding payment:",
        error,
      );

      alert("Failed to add payment.");
    }
  };

  /*
   * Update Payment
   */
  const handleUpdatePayment = async (e) => {
    e.preventDefault();

    if (!isAdmin) return;

    if (!formData.memberId) {
      alert("Please select a member.");
      return;
    }

    try {
      const selectedMember =
        getSelectedMember();

      if (!selectedMember) {
        alert(
          "Selected member was not found.",
        );
        return;
      }

      // Preserve the historical amount/plan for old payment records.
      // If the record is from the current plan, use the member's current price.
      const historicalPrice = Number(editingPayment.membershipPrice || 0);
      const membershipPrice = historicalPrice > 0
        ? historicalPrice
        : getMembershipPrice(selectedMember);

      if (membershipPrice <= 0) {
        alert("This payment does not have a valid membership plan price.");
        return;
      }

      /*
       * Every payment is exactly one full membership price.
       */
      const cycleNumber = Number(
        editingPayment.cycleNumber || getCurrentCycleNumber(selectedMember),
      );

      // Only resync the member if this payment belongs to the current cycle.
      if (cycleNumber === getCurrentCycleNumber(selectedMember)) {
        await syncMemberMembership(
          selectedMember,
          getMembershipPrice(selectedMember),
          formData.paymentDate,
          cycleNumber,
        );
      }

      const paymentStatus = "Fully Paid";

      const paymentRef = doc(
        db,
        "payments",
        editingPayment.id,
      );

      await updateDoc(paymentRef, {
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        amount: membershipPrice,
        paymentType: editingPayment.paymentType || "Initial",
        cycleNumber,
        paymentDate:
          formData.paymentDate,
        paymentMethod:
          formData.paymentMethod,
        membership:
          editingPayment.membership ||
          formData.membership ||
          selectedMember.membershipName ||
          "",
        membershipPrice: Number(editingPayment.membershipPrice || membershipPrice),
        membershipDuration: Number(editingPayment.membershipDuration || selectedMember.membershipDuration || 0),
        membershipId: editingPayment.membershipId || selectedMember.membershipId || null,
        notes: formData.notes.trim(),
      });

      await logActivity({
        action: "Payment Updated",
        description: `Updated payment for ${selectedMember.name
          } - ${paymentStatus}`,
        targetType: "payment",
        targetId: editingPayment.id,
      });

      alert(
        "Payment updated successfully!",
      );

      closeModal();
    } catch (error) {
      console.error(
        "Error updating payment:",
        error,
      );

      alert("Failed to update payment.");
    }
  };

  /*
   * Delete Payment
   */
  const handleDeletePayment = async (payment) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete this payment from ${payment.memberName}?`,
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(
        doc(db, "payments", payment.id),
      );

      const selectedMember = members.find(
        (member) => member.id === payment.memberId,
      );

      if (selectedMember) {
        const cycleNumber = Number(
          payment.cycleNumber || getCurrentCycleNumber(selectedMember),
        );

        const remainingTotalPaid = getMemberTotalPaid(
          selectedMember.id,
          payment.id,
          cycleNumber,
        );

        await syncMemberMembership(
          selectedMember,
          remainingTotalPaid,
          null,
          cycleNumber,
        );
      }

      await logActivity({
        action: "Payment Deleted",
        description: `Deleted payment of ₱${Number(
          payment.amount || 0,
        ).toLocaleString()} for ${payment.memberName ||
        "Unknown Member"
          }`,
        targetType: "payment",
        targetId: payment.id,
      });

      alert(
        "Payment deleted successfully!",
      );
    } catch (error) {
      console.error(
        "Error deleting payment:",
        error,
      );

      alert("Failed to delete payment.");
    }
  };

  /*
   * Close Modal
   */
  const closeModal = () => {
    setShowModal(false);
    setEditingPayment(null);

    setFormData({
      memberId: "",
      amount: "",
      paymentDate: "",
      paymentMethod: "Cash",
      membership: "",
      notes: "",
    });
  };

  /*
   * Format Amount
   */
  const formatAmount = (amount) => {
    return `₱${Number(
      amount || 0,
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  /*
   * Format Date
   */
  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (
      Number.isNaN(parsedDate.getTime())
    ) {
      return "-";
    }

    return parsedDate.toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    );
  };

  /*
   * Get Status Class
   */
  const getStatusClass = (status) => {
    if (status === "Fully Paid") {
      return "fully-paid";
    }

    return "no-payment";
  };

  /*
   * Members who need a payment
   *
   * Only show:
   * - Members who have not paid their current plan
   * - Members whose membership has expired and needs renewal
   *
   * Fully paid active members are hidden from the payment list.
   */
  const paymentMembers = members.filter((member) => {
    const paymentInfo = getPaymentStatus(member.id);
    const expired = isMembershipExpired(member);

    return expired || paymentInfo.status !== "Fully Paid";
  });

  const filteredPaymentMembers = paymentMembers.filter((member) => {
    const searchText = search.toLowerCase();
    const paymentInfo = getPaymentStatus(member.id);
    const expired = isMembershipExpired(member);
    const paymentType = expired ? "renewal" : "unpaid";

    return (
      (member.name || "").toLowerCase().includes(searchText) ||
      (member.membershipName || "").toLowerCase().includes(searchText) ||
      paymentInfo.status.toLowerCase().includes(searchText) ||
      paymentType.includes(searchText)
    );
  });

  /*
   * Calculate Total Revenue
   */
  const totalRevenue = payments.reduce(
    (total, payment) =>
      total + Number(payment.amount || 0),
    0,
  );

  /*
   * Count Fully Paid Members
   */
  const fullyPaidMembers =
    members.filter((member) => {
      const paymentInfo =
        getPaymentStatus(member.id);

      return (
        paymentInfo.status === "Fully Paid"
      );
    }).length;

  return (
    <div className="payments-page">
      {/* Header */}
      <div className="payments-header">
        <div>
          <h1>Payments</h1>

          <p>
            Manage member payments and
            transactions.
          </p>
        </div>

        <button
          className="add-payment-btn"
          onClick={openAddPaymentModal}
        >
          + Add Payment
        </button>
      </div>

      {/* Summary */}
      <div className="payment-summary">
        <div className="payment-summary-card">
          <span>Total Payments</span>

          <strong>
            {payments.length}
          </strong>
        </div>

        <div className="payment-summary-card">
          <span>Total Revenue</span>

          <strong className="payment-total-revenue">
            {formatAmount(totalRevenue)}
          </strong>
        </div>

        <div className="payment-summary-card">
          <span>Fully Paid Members</span>

          <strong className="payment-status-full">
            {fullyPaidMembers}
          </strong>
        </div>

        <div className="payment-summary-card">
          <span>Unpaid Members</span>

          <strong className="payment-status-partial">
            {members.length - fullyPaidMembers}
          </strong>
        </div>
      </div>

      {/* Payments Card */}
      <div className="payments-card">
        <div className="payments-card-header">
          <div>
            <h2>Members Needing Payment</h2>

            <p>
              Only unpaid members and members who need renewal are shown.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search payments..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="payment-message">
            Loading payments...
          </p>
        ) : filteredPaymentMembers.length ===
          0 ? (
          <p className="payment-message">
            No members need payment right now.
          </p>
        ) : (
          <div className="payments-table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Membership</th>
                  <th>Membership Price</th>
                  <th>Total Paid</th>
                  <th>Remaining</th>
                  <th>Payment Status</th>
                  <th>Payment Needed</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredPaymentMembers.map(
                  (member) => {
                    const paymentInfo =
                      getPaymentStatus(member.id);
                    const expired =
                      isMembershipExpired(member);

                    return (
                      <tr key={member.id}>
                        <td>
                          <strong>
                            {member.name ||
                              "Unknown Member"}
                          </strong>
                        </td>

                        <td>
                          {member.membershipName ||
                            "-"}
                        </td>

                        <td>
                          {formatAmount(
                            paymentInfo.price,
                          )}
                        </td>

                        <td>
                          <span className="payment-amount">
                            {formatAmount(
                              paymentInfo.paid,
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              paymentInfo.remaining >
                                0
                                ? "payment-remaining"
                                : "payment-zero"
                            }
                          >
                            {formatAmount(
                              paymentInfo.remaining,
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`payment-status ${getStatusClass(
                              paymentInfo.status,
                            )}`}
                          >
                            {expired
                              ? "Needs Renewal"
                              : paymentInfo.status}
                          </span>
                        </td>

                        <td>
                          {expired
                            ? "Needs Renewal"
                            : "New Membership"}
                        </td>

                        <td>
                          <span className={`payment-method ${expired
                            ? "renewal-label"
                            : "unpaid-label"
                            }`}>
                            {expired
                              ? "Renewal"
                              : "Unpaid"}
                          </span>
                        </td>

                        <td>
                          <button
                            className="edit-payment-btn"
                            onClick={() => {
                              setEditingPayment(null);
                              setFormData({
                                memberId: member.id,
                                amount: String(
                                  getMembershipPrice(member),
                                ),
                                paymentDate: new Date()
                                  .toISOString()
                                  .split("T")[0],
                                paymentMethod: "Cash",
                                membership:
                                  member.membershipName || "",
                                notes: "",
                              });
                              setShowModal(true);
                            }}
                          >
                            {expired ? "Renew" : "Pay"}
                          </button>
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

      {/* PAYMENT HISTORY */}
      <div className="payments-card payment-history-card">
        <div className="payments-card-header">
          <div>
            <h2>Payment History</h2>
            <p>View all recorded payment transactions, including previous memberships and renewals.</p>
          </div>
        </div>

        {loading ? (
          <p className="payment-message">Loading payment history...</p>
        ) : payments.filter((payment) => {
          const searchText = search.toLowerCase();
          return (
            (payment.memberName || "").toLowerCase().includes(searchText) ||
            (payment.membership || "").toLowerCase().includes(searchText) ||
            (payment.paymentMethod || "").toLowerCase().includes(searchText) ||
            String(payment.amount || "").includes(searchText)
          );
        }).length === 0 ? (
          <p className="payment-message">No payment history found.</p>
        ) : (
          <div className="payments-table-container">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Membership</th>
                  <th>Amount</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.filter((payment) => {
                  const searchText = search.toLowerCase();
                  return (
                    (payment.memberName || "").toLowerCase().includes(searchText) ||
                    (payment.membership || "").toLowerCase().includes(searchText) ||
                    (payment.paymentMethod || "").toLowerCase().includes(searchText) ||
                    String(payment.amount || "").includes(searchText)
                  );
                }).map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{payment.memberName || "Unknown Member"}</strong></td>
                    <td>{payment.membership || "-"}</td>
                    <td><span className="payment-amount">{formatAmount(payment.amount)}</span></td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td><span className="payment-method">{payment.paymentMethod || "-"}</span></td>
                    <td>
                      <span className="payment-status fully-paid">
                        {payment.paymentType || (Number(payment.cycleNumber || 1) > 1 ? "Renewal" : "Initial")}
                      </span>
                    </td>
                    <td>
                      {isAdmin && (
                        <>
                          <button
                            className="edit-payment-btn"
                            onClick={() => handleEditClick(payment)}
                          >
                            Edit
                          </button>

                          <button
                            className="delete-payment-btn"
                            onClick={() => handleDeletePayment(payment)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT PAYMENT MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >
          <div
            className="payment-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>
                  {editingPayment
                    ? "Edit Payment"
                    : "Add Payment"}
                </h2>

                <p>
                  Record a member payment.
                </p>
              </div>

              <button
                className="close-btn"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                editingPayment
                  ? handleUpdatePayment
                  : handleAddPayment
              }
            >
              {/* Member */}
              <div className="form-group">
                <label>Member</label>

                <select
                  name="memberId"
                  value={formData.memberId}
                  onChange={handleChange}
                  required
                  disabled={membersLoading || Boolean(editingPayment)}
                >
                  <option value="">
                    {membersLoading
                      ? "Loading members..."
                      : "Select a member"}
                  </option>

                  {paymentMembers.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member Payment Information */}
              {formData.memberId && (
                <div className="member-payment-info">
                  {(() => {
                    const selectedMember =
                      getSelectedMember();

                    const paymentInfo =
                      getPaymentStatus(
                        formData.memberId,
                      );

                    return (
                      <>
                        <div>
                          <span>
                            Selected Member
                          </span>

                          <strong>
                            {
                              selectedMember?.name
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Membership
                          </span>

                          <strong>
                            {formData.membership ||
                              "No Membership"}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Membership Price
                          </span>

                          <strong>
                            {formatAmount(
                              paymentInfo.price,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Already Paid
                          </span>

                          <strong className="modal-paid">
                            {formatAmount(
                              paymentInfo.paid,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Remaining Balance
                          </span>

                          <strong className="modal-remaining">
                            {formatAmount(
                              paymentInfo.remaining,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Current Status
                          </span>

                          <strong
                            className={`modal-payment-status ${getStatusClass(
                              paymentInfo.status,
                            )}`}
                          >
                            {
                              paymentInfo.status
                            }
                          </strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Fixed Plan Amount */}
              <div className="form-group">
                <label>Amount to Pay (Fixed)</label>

                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  readOnly
                  placeholder="Select a member first"
                  required
                />

                <small>
                  The payment amount is fixed to the selected membership plan price.
                </small>
              </div>

              {/* Payment Date */}
              <div className="form-group">
                <label>
                  Payment Date
                </label>

                <input
                  type="date"
                  name="paymentDate"
                  value={
                    formData.paymentDate
                  }
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>
                  Payment Method
                </label>

                <select
                  name="paymentMethod"
                  value={
                    formData.paymentMethod
                  }
                  onChange={handleChange}
                  required
                >
                  <option value="Cash">
                    Cash
                  </option>

                  <option value="GCash">
                    GCash
                  </option>

                  <option value="Bank Transfer">
                    Bank Transfer
                  </option>

                  <option value="Card">
                    Card
                  </option>
                </select>
              </div>

              {/* Fixed Membership Plan */}
              <div className="form-group">
                <label>Membership Plan (Fixed)</label>
                <input
                  type="text"
                  value={formData.membership || "Select a member first"}
                  readOnly
                />
                <small>
                  The member's assigned plan cannot be changed from Payments. Use Change Plan from Members.
                </small>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>

                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                  rows="3"
                />
              </div>

              {/* Modal Actions */}
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
                >
                  {editingPayment
                    ? "Update Payment"
                    : "Add Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments;