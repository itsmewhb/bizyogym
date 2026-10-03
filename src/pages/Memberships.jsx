import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Memberships.css";

function Memberships() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration: "",
    description: "",
  });

  // REAL-TIME FIRESTORE DATA
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "memberships"),
      (snapshot) => {
        const plansData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setPlans(plansData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading membership plans:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "price") {
      // Numbers only
      if (!/^\d*$/.test(value)) {
        return;
      }

      // Maximum 7 digits
      if (value.length > 7) {
        return;
      }
    }

    if (name === "duration") {
      // Numbers only
      if (!/^\d*$/.test(value)) {
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      duration: "",
      description: "",
    });

    setEditingPlan(null);
  };

  // ADD PLAN
  const handleAddPlan = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "memberships"), {
        name: formData.name,
        price: Number(formData.price),
        duration: Number(formData.duration),
        description: formData.description,
        createdAt: serverTimestamp(),
      });

      alert("Membership plan added successfully!");

      resetForm();
      setShowModal(false);
    } catch (error) {
      console.error("Error adding membership plan:", error);
      alert("Failed to add membership plan.");
    }
  };

  // EDIT BUTTON
  const handleEditClick = (plan) => {
    setEditingPlan(plan);

    setFormData({
      name: plan.name || "",
      price: plan.price || "",
      duration: plan.duration || "",
      description: plan.description || "",
    });

    setShowModal(true);
  };

  // UPDATE PLAN
  const handleUpdatePlan = async (e) => {
    e.preventDefault();

    try {
      await updateDoc(doc(db, "memberships", editingPlan.id), {
        name: formData.name,
        price: Number(formData.price),
        duration: Number(formData.duration),
        description: formData.description,
      });

      alert("Membership plan updated successfully!");

      resetForm();
      setShowModal(false);
    } catch (error) {
      console.error("Error updating membership plan:", error);
      alert("Failed to update membership plan.");
    }
  };

  // DELETE PLAN
  const handleDeletePlan = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this membership plan?"
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "memberships", id));

      alert("Membership plan deleted successfully!");
    } catch (error) {
      console.error("Error deleting membership plan:", error);
      alert("Failed to delete membership plan.");
    }
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <div className="memberships-page">
      <div className="memberships-header">
        <div>
          <h1>Membership Plans</h1>
          <p>Create and manage your gym membership plans.</p>
        </div>

        <button className="add-plan-btn" onClick={openAddModal}>
          + Add Membership Plan
        </button>
      </div>

      <div className="plans-grid">
        {loading ? (
          <p className="plans-message">Loading membership plans...</p>
        ) : plans.length === 0 ? (
          <p className="plans-message">
            No membership plans found. Create your first plan.
          </p>
        ) : (
          plans.map((plan) => (
            <div className="plan-card" key={plan.id}>
              <div className="plan-card-header">
                <h2>{plan.name}</h2>

                <span className="plan-price">
                  ₱{Number(plan.price || 0).toLocaleString()}
                </span>
              </div>

              <p className="plan-duration">
                {plan.duration} day(s)
                {Number(plan.duration) > 1 ? "s" : ""}
              </p>

              <p className="plan-description">
                {plan.description || "No description provided."}
              </p>

              <div className="plan-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEditClick(plan)}
                >
                  Edit
                </button>

                <button
                  className="delete-btn"
                  onClick={() => handleDeletePlan(plan.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL */}
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
                {editingPlan
                  ? "Edit Membership Plan"
                  : "Add Membership Plan"}
              </h2>

              <button
                className="close-btn"
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                editingPlan
                  ? handleUpdatePlan
                  : handleAddPlan
              }
            >
              <div className="form-group">
                <label>Plan Name</label>

                <input
                  type="text"
                  name="name"
                  placeholder="Example: Premium"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Price (₱)</label>

                <input
                  type="text"
                  name="price"
                  placeholder="Example: 1500"
                  value={formData.price}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={7}
                  required
                />
              </div>

              <div className="form-group">
                <label>Duration (Days)</label>

                <input
                  type="number"
                  name="duration"
                  placeholder="Example: 1"
                  value={formData.duration}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>

                <textarea
                  name="description"
                  placeholder="Describe what this membership includes..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    resetForm();
                    setShowModal(false);
                  }}
                >
                  Cancel
                </button>

                <button type="submit" className="save-btn">
                  {editingPlan
                    ? "Update Plan"
                    : "Add Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Memberships;