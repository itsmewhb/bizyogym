import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Members.css";
import { QRCodeSVG } from "qrcode.react";
import { logActivity } from "../utils/activityLogger";

function Members() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [editingMember, setEditingMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);

  // Set default values for form data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    membershipId: "",
    membershipStartDate: "",
    status: "Active",
  });

  // State for selected member's QR code
  const [selectedMemberQR, setSelectedMemberQR] = useState(null);

  // =========================================================
  // DATE HELPERS
  // =========================================================

  // Returns today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Calculate expiration date based on:
  // Start Date + Membership Duration
  const calculateExpirationDate = (startDate, duration) => {
    if (!startDate || !duration) {
      return "";
    }

    const date = new Date(`${startDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    date.setDate(date.getDate() + Number(duration));

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Format YYYY-MM-DD for display
  const formatDate = (dateString) => {
    if (!dateString) {
      return "N/A";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMemberStatus = (member) => {
    if (member.isRestricted) return "Restricted";

    const price = Number(member.membershipPrice || 0);
    if (price > 0 && !member.membershipStartDate) return "Unpaid";

    if (member.membershipExpirationDate) {
      const expirationDate = new Date(
        `${member.membershipExpirationDate}T23:59:59`,
      );
      if (!Number.isNaN(expirationDate.getTime()) && new Date() > expirationDate) {
        return "Expired";
      }
    }

    return member.status || "Inactive";
  };

  const isMemberUnpaid = (member) => {
    const price = Number(member.membershipPrice || 0);
    return price > 0 && member.status !== "Active";
  };

  // =========================================================
  // QR CODE
  // =========================================================

  const handleShowQR = (member) => {
    setSelectedMemberQR(member);
  };

  // =========================================================
  // FETCH MEMBERSHIP PLANS
  // =========================================================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "memberships"),
      (snapshot) => {
        const plansData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setMembershipPlans(plansData);
      },
      (error) => {
        console.error("Error loading membership plans:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // FETCH MEMBERS
  // =========================================================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "members"),
      (snapshot) => {
        const membersData = snapshot.docs
          .map((memberDoc) => ({
            id: memberDoc.id,
            ...memberDoc.data(),
          }))
          .sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || 0;

            return dateB - dateA;
          });

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
  
  // =========================================================
  // DELETE MEMBER
  // =========================================================

  const handleDeleteMember = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this member?",
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const memberToDelete = members.find(
        (member) => member.id === id,
      );

      await deleteDoc(doc(db, "members", id));

      if (memberToDelete) {
        await logActivity({
          action: "Member Deleted",
          description: `Deleted member ${memberToDelete.name}`,
          targetType: "member",
          targetId: id,
        });
      }

      alert("Member deleted successfully!");
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member.");
    }
  };

  // =========================================================
  // EDIT MEMBER
  // =========================================================

  const handleEditClick = (member) => {
    setEditingMember(member);

    // Membership dates are controlled by payments.
    // They are not manually started from the Members page.
    setFormData({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      membershipId: member.membershipId || "",
      membershipStartDate: member.membershipStartDate || "",
      status: member.status || "Active",
    });

    setShowModal(true);
  };

  // =========================================================
  // UPDATE MEMBER
  // =========================================================

  const handleUpdateMember = async (e) => {
    e.preventDefault();

    try {
      const selectedPlan = membershipPlans.find(
        (plan) => plan.id === formData.membershipId,
      );

      if (!selectedPlan) {
        alert("Please select a valid membership plan.");
        return;
      }

      const memberRef = doc(
        db,
        "members",
        editingMember.id,
      );

      await updateDoc(memberRef, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,

        // Keep existing membership fields
        // so other pages continue working.
        membershipId: selectedPlan.id,
        membershipName: selectedPlan.name,
        membershipPrice: Number(selectedPlan.price),
        membershipDuration: Number(selectedPlan.duration),

        // Membership dates are controlled by Payments.
        // Keep the existing dates when editing member details.
        membershipStartDate:
          editingMember.membershipStartDate || null,
        membershipExpirationDate:
          editingMember.membershipExpirationDate || null,

        status: formData.status,
      });

      await logActivity({
        action: "Member Updated",
        description: `Updated member ${formData.name}`,
        targetType: "member",
        targetId: editingMember.id,
      });

      alert("Member updated successfully!");

      setEditingMember(null);

      setFormData({
        name: "",
        email: "",
        phone: "",
        membershipId: "",
        membershipStartDate: "",
        status: "Active",
      });

      setShowModal(false);
    } catch (error) {
      console.error("Error updating member:", error);
      alert("Failed to update member.");
    }
  };

  // =========================================================
  // HANDLE FORM CHANGES
  // =========================================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // =========================================================
  // ADD MEMBER
  // =========================================================

  const handleAddMember = async (e) => {
    e.preventDefault();

    try {
      // Find selected membership plan
      const selectedPlan = membershipPlans.find(
        (plan) => plan.id === formData.membershipId,
      );

      if (!selectedPlan) {
        alert("Please select a valid membership plan.");
        return;
      }

      const newMemberRef = await addDoc(
        collection(db, "members"),
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,

          // Existing membership information
          membershipId: selectedPlan.id,
          membershipName: selectedPlan.name,
          membershipPrice: Number(selectedPlan.price),
          membershipDuration: Number(selectedPlan.duration),

          // Membership has not started yet.
          // Payments will set these fields when fully paid.
          membershipStartDate: null,
          membershipExpirationDate: null,

          status: formData.status,
          createdAt: serverTimestamp(),
        },
      );

      await logActivity({
        action: "Member Added",
        description: `Added new member ${formData.name}`,
        targetType: "member",
        targetId: newMemberRef.id,
      });

      alert("Member added successfully!");

      setFormData({
        name: "",
        email: "",
        phone: "",
        membershipId: "",
        membershipStartDate: "",
        status: "Active",
      });

      setShowModal(false);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member.");
    }
  };

  // =========================================================
  // OPEN ADD MEMBER MODAL
  // =========================================================

  const openAddMemberModal = () => {
    setEditingMember(null);

    setFormData({
      name: "",
      email: "",
      phone: "",
      membershipId: "",
      membershipStartDate: "",
      status: "Active",
    });

    setShowModal(true);
  };

  // =========================================================
  // FILTER MEMBERS
  // =========================================================

  const filteredMembers = members.filter((member) =>
    (member.name || "")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="members-page">
      <div className="members-header">
        <div>
          <h1>Members</h1>
          <p>Manage your gym members.</p>
        </div>

        <button
          className="add-member-btn"
          onClick={openAddMemberModal}
        >
          + Add Member
        </button>
      </div>

      <div className="members-card">
        <div className="members-toolbar">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Membership</th>
                <th>Expiration</th>
                <th>Status</th>
                <th>Actions</th>
                <th>Qr Code</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="loading-message"
                  >
                    Loading members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="empty-message"
                  >
                    No members found.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-name">
                        <div className="table-avatar">
                          {(member.name || "?").charAt(0)}
                        </div>

                        {member.name}
                      </div>
                    </td>

                    <td>{member.email}</td>

                    <td>{member.phone}</td>

                    <td>{member.membershipName}</td>

                    <td>
                      {formatDate(
                        member.membershipExpirationDate,
                      )}
                    </td>

                    <td>
                      <span
                        className={`member-status ${getMemberStatus(member) === "Restricted"
                          ? "restricted"
                          : getMemberStatus(member) === "Unpaid"
                            ? "unpaid"
                            : getMemberStatus(member) === "Expired"
                              ? "expired"
                              : getMemberStatus(member) === "Active"
                                ? "active"
                                : "inactive"
                          }`}
                      >
                        {getMemberStatus(member)}
                      </span>
                    </td>

                    <td>
                      <button
                        className="edit-btn"
                        onClick={() =>
                          handleEditClick(member)
                        }
                      >
                        Edit
                      </button>

                      {getMemberStatus(member) === "Unpaid" && (
                        <button
                          className="edit-btn"
                          style={{ marginRight: "6px", background: "#ff8c00", color: "#fff" }}
                          onClick={() => navigate("/payments")}
                        >
                          Pay
                        </button>
                      )}



                      {getMemberStatus(member) === "Expired" && (
                        <button
                          className="edit-btn"
                          style={{ marginRight: "6px" }}
                          onClick={() => navigate("/payments")}
                        >
                          Renew
                        </button>
                      )}

                      <button
                        className="delete-btn"
                        onClick={() =>
                          handleDeleteMember(member.id)
                        }
                      >
                        Delete
                      </button>
                    </td>

                    <td>
                      <button
                        className="qr-btn"
                        onClick={() =>
                          handleShowQR(member)
                        }
                      >
                        View QR
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          ADD / EDIT MEMBER MODAL
          ===================================================== */}

      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="member-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {editingMember
                  ? "Edit Member"
                  : "Add New Member"}
              </h2>

              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                editingMember
                  ? handleUpdateMember
                  : handleAddMember
              }
            >
              {/* FULL NAME */}
              <div className="form-group">
                <label>Full Name</label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* EMAIL */}
              <div className="form-group">
                <label>Email</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email"
                  required
                />
              </div>

              {/* PHONE */}
              <div className="form-group">
                <label>Phone Number</label>

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value;

                    // Allow numbers only
                    if (!/^\d*$/.test(value)) {
                      return;
                    }

                    // Maximum of 11 digits
                    if (value.length > 11) {
                      return;
                    }

                    setFormData({
                      ...formData,
                      phone: value,
                    });
                  }}
                  placeholder="09XXXXXXXXX"
                  inputMode="numeric"
                  pattern="09[0-9]{9}"
                  maxLength={11}
                  minLength={11}
                  required
                />

                <small style={{ color: "#666" }}>
                  Must be 11 digits and start with 09.
                </small>
              </div>

              {/* MEMBERSHIP PLAN */}
              <div className="form-group">
                <label>Membership Plan</label>

                <select
                  name="membershipId"
                  value={formData.membershipId}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select a membership plan
                  </option>

                  {membershipPlans.map((plan) => (
                    <option
                      key={plan.id}
                      value={plan.id}
                    >
                      {plan.name} - ₱
                      {Number(
                        plan.price,
                      ).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* MEMBERSHIP START / PAYMENT NOTICE */}
              <div
                className="form-group"
                style={{
                  padding: "12px",
                  background: "#161622",
                  border: "1px solid #303044",
                  borderRadius: "8px",
                }}
              >
                <label>Membership Start</label>
                <div
                  style={{
                    color: "#ff8c00",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Starts after full payment
                </div>
                <small
                  style={{
                    display: "block",
                    marginTop: "5px",
                    color: "#666",
                  }}
                >
                  The membership period begins automatically when the member
                  has fully paid for the selected plan.
                </small>
              </div>

              {/* MEMBERSHIP PREVIEW */}
              {editingMember?.membershipStartDate &&
                (() => {
                  const selectedPlan =
                    membershipPlans.find(
                      (plan) =>
                        plan.id ===
                        formData.membershipId,
                    );

                  if (!selectedPlan) {
                    return null;
                  }

                  const expirationDate =
                    calculateExpirationDate(
                      editingMember.membershipStartDate,
                      selectedPlan.duration,
                    );

                  return (
                    <div
                      className="form-group"
                      style={{
                        padding: "12px",
                        background: "#161622",
                        border: "1px solid #303044",
                        borderRadius: "8px",
                      }}
                    >
                      <label>
                        Membership Expiration
                      </label>

                      <div
                        style={{
                          color: "#ff8c00",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                      >
                        {formatDate(expirationDate)}
                      </div>

                      <small
                        style={{
                          display: "block",
                          marginTop: "5px",
                          color: "#666",
                        }}
                      >
                        {selectedPlan.duration}{" "}
                        day(s) membership
                      </small>
                    </div>
                  );
                })()}

              {/* STATUS */}
              <div className="form-group">
                <label>Status</label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>
              </div>

              {/* MODAL ACTIONS */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                >
                  {editingMember
                    ? "Update Member"
                    : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          MEMBER QR CODE MODAL

          IMPORTANT:
          This still uses member.id as the QR value.
          Do not change this because EntryLog reads the
          Firestore member document ID.
          ===================================================== */}

      {selectedMemberQR && (
        <div className="modal-overlay">
          <div className="qr-modal">
            <div className="modal-header">
              <h2>Member QR Code</h2>

              <button
                className="close-btn"
                onClick={() =>
                  setSelectedMemberQR(null)
                }
              >
                ×
              </button>
            </div>

            <div className="qr-content">
              <h3>{selectedMemberQR.name}</h3>

              <p>
                Scan this QR code for gym entry.
              </p>

              <div className="qr-code-container">
                <QRCodeSVG
                  value={selectedMemberQR.id}
                  size={220}
                />
              </div>

              <small>
                Member ID: {selectedMemberQR.id}
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;