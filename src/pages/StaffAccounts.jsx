import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getApps,
  getApp,
  initializeApp,
} from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
} from "firebase/auth";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { logActivity } from "../utils/activityLogger";
import "./StaffAccounts.css";

// Separate Firebase Auth instance.
// This prevents the Admin from being logged out
// when creating a Staff account.
const primaryApp = getApp();

const staffApp =
  getApps().find(
    (app) => app.name === "staffAccountApp",
  ) ||
  initializeApp(
    primaryApp.options,
    "staffAccountApp",
  );

const staffAuth = getAuth(staffApp);

function StaffAccounts() {
  const { isAdmin } = useAuth();

  const [staffAccounts, setStaffAccounts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [showModal, setShowModal] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

  /*
   * Load Staff accounts
   */
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const staffData = snapshot.docs
          .map((userDoc) => ({
            id: userDoc.id,
            ...userDoc.data(),
          }))
          .filter(
            (user) =>
              user.role === "staff",
          );

        setStaffAccounts(staffData);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error loading Staff accounts:",
          error,
        );

        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [isAdmin]);

  /*
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /*
   * Open Add Staff modal
   */
  const openAddModal = () => {
    if (!isAdmin) return;

    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setShowModal(true);
  };

  /*
   * Close modal
   */
  const closeModal = () => {
    if (creating) return;

    setShowModal(false);

    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  /*
   * Create Staff account
   */
  const handleCreateStaff = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      alert(
        "You do not have permission to create Staff accounts.",
      );
      return;
    }

    const name = formData.name.trim();

    const email = formData.email
      .trim()
      .toLowerCase();

    if (!name) {
      alert("Please enter the Staff name.");
      return;
    }

    if (!email) {
      alert("Please enter an email address.");
      return;
    }

    if (formData.password.length < 6) {
      alert(
        "Password must be at least 6 characters.",
      );
      return;
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      alert("Passwords do not match.");
      return;
    }

    setCreating(true);

    try {
      /*
       * Create Firebase Authentication account
       * using the secondary Firebase Auth instance.
       */
      const userCredential =
        await createUserWithEmailAndPassword(
          staffAuth,
          email,
          formData.password,
        );

      const staffUser =
        userCredential.user;

      /*
       * Create Staff profile
       */
      await setDoc(
        doc(db, "users", staffUser.uid),
        {
          uid: staffUser.uid,
          name,
          email,
          role: "staff",
          status: "Active",
          createdAt: serverTimestamp(),
        },
      );

      /*
       * Log account creation
       */
      await logActivity(
        "Staff Account Created",
        `Created Staff account for ${name} (${email})`,
      );

      alert(
        `Staff account created successfully for ${name}.`,
      );

      closeModal();
    } catch (error) {
      console.error(
        "Error creating Staff account:",
        error,
      );

      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        alert(
          "This email address is already registered.",
        );
      } else if (
        error.code ===
        "auth/invalid-email"
      ) {
        alert(
          "Please enter a valid email address.",
        );
      } else if (
        error.code ===
        "auth/weak-password"
      ) {
        alert(
          "The password is too weak. Please use a stronger password.",
        );
      } else {
        alert(
          "Something went wrong while creating the Staff account.",
        );
      }
    } finally {
      setCreating(false);
    }
  };

  /*
   * Toggle Staff status
   */
  const handleToggleStatus = async (
    staff,
  ) => {
    if (!isAdmin) return;

    // Extra safety check
    if (staff.role !== "staff") {
      return;
    }

    const currentStatus =
      staff.status === "Inactive"
        ? "Inactive"
        : "Active";

    const newStatus =
      currentStatus === "Active"
        ? "Inactive"
        : "Active";

    const action =
      newStatus === "Inactive"
        ? "deactivate"
        : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${staff.name}?`,
    );

    if (!confirmed) return;

    setUpdatingStatus(staff.id);

    try {
      await updateDoc(
        doc(db, "users", staff.id),
        {
          status: newStatus,
          statusUpdatedAt:
            serverTimestamp(),
        },
      );

      await logActivity(
        `Staff Account ${newStatus}`,
        `${
          newStatus === "Active"
            ? "Activated"
            : "Deactivated"
        } Staff account for ${
          staff.name
        } (${staff.email})`,
      );

      alert(
        `${staff.name} is now ${newStatus}.`,
      );
    } catch (error) {
      console.error(
        "Error updating Staff status:",
        error,
      );

      alert(
        "Something went wrong while updating the Staff status.",
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  /*
   * Search Staff
   */
  const filteredStaff =
    staffAccounts.filter((staff) => {
      const searchText =
        search.toLowerCase();

      return (
        (staff.name || "")
          .toLowerCase()
          .includes(searchText) ||
        (staff.email || "")
          .toLowerCase()
          .includes(searchText)
      );
    });

  /*
   * Admin-only protection
   */
  if (!isAdmin) {
    return (
      <div className="staff-access-denied">
        <div className="access-denied-card">
          <div className="access-denied-icon">
            🔒
          </div>

          <h2>Access Denied</h2>

          <p>
            You do not have permission to
            manage Staff accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-accounts-page">
      {/* HEADER */}
      <div className="staff-accounts-header">
        <div>
          <h1>Staff Accounts</h1>

          <p>
            Create and manage Staff accounts
            for the Bizyo system.
          </p>
        </div>

        <button
          className="add-staff-btn"
          onClick={openAddModal}
        >
          + Add Staff
        </button>
      </div>

      {/* STAFF CARD */}
      <div className="staff-accounts-card">
        <div className="staff-card-header">
          <div>
            <h2>Staff Members</h2>

            <p>
              Manage accounts with Staff
              access.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        {loading ? (
          <p className="staff-message">
            Loading Staff accounts...
          </p>
        ) : filteredStaff.length === 0 ? (
          <p className="staff-message">
            No Staff accounts found.
          </p>
        ) : (
          <div className="staff-table-container">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map(
                  (staff) => {
                    const createdAt =
                      staff.createdAt?.toDate?.();

                    /*
                     * Missing status is treated
                     * as Active.
                     */
                    const status =
                      staff.status ===
                      "Inactive"
                        ? "Inactive"
                        : "Active";

                    return (
                      <tr key={staff.id}>
                        <td>
                          <div className="staff-member">
                            <div className="staff-avatar">
                              {staff.name
                                ?.charAt(0)
                                .toUpperCase()}
                            </div>

                            <strong>
                              {staff.name ||
                                "Unnamed Staff"}
                            </strong>
                          </div>
                        </td>

                        <td>
                          {staff.email ||
                            "-"}
                        </td>

                        <td>
                          <span className="staff-role-badge">
                            Staff
                          </span>
                        </td>

                        <td>
                          <span
                            className={`staff-status-badge ${
                              status ===
                              "Active"
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            {status}
                          </span>
                        </td>

                        <td>
                          {createdAt
                            ? createdAt.toLocaleDateString(
                                "en-PH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : "-"}
                        </td>

                        <td>
                          <button
                            className={`staff-status-btn ${
                              status ===
                              "Active"
                                ? "deactivate"
                                : "activate"
                            }`}
                            onClick={() =>
                              handleToggleStatus(
                                staff,
                              )
                            }
                            disabled={
                              updatingStatus ===
                              staff.id
                            }
                          >
                            {updatingStatus ===
                            staff.id
                              ? "Updating..."
                              : status ===
                                  "Active"
                                ? "Deactivate"
                                : "Activate"}
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

      {/* ADD STAFF MODAL */}
      {showModal && (
        <div className="staff-modal-overlay">
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <h2>Create Staff Account</h2>

                <p>
                  Create login credentials
                  for a new Staff member.
                </p>
              </div>

              <button
                className="staff-close-btn"
                onClick={closeModal}
                disabled={creating}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateStaff}
            >
              <div className="staff-form-group">
                <label>
                  Full Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                  disabled={creating}
                />
              </div>

              <div className="staff-form-group">
                <label>
                  Email Address
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  required
                  disabled={creating}
                />
              </div>

              <div className="staff-form-group">
                <label>
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  value={
                    formData.password
                  }
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                  minLength={6}
                  disabled={creating}
                />
              </div>

              <div className="staff-form-group">
                <label>
                  Confirm Password
                </label>

                <input
                  type="password"
                  name="confirmPassword"
                  value={
                    formData.confirmPassword
                  }
                  onChange={handleChange}
                  placeholder="Confirm password"
                  required
                  minLength={6}
                  disabled={creating}
                />
              </div>

              <div className="staff-account-info">
                <span className="info-dot">
                  ✓
                </span>

                <p>
                  New Staff accounts are
                  automatically created as{" "}
                  <strong>Active</strong>.
                </p>
              </div>

              <div className="staff-modal-actions">
                <button
                  type="button"
                  className="staff-cancel-btn"
                  onClick={closeModal}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="staff-save-btn"
                  disabled={creating}
                >
                  {creating
                    ? "Creating..."
                    : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffAccounts;