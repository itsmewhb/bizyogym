import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Incidents.css";

function Incidents() {
  const { isAdmin } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);

  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    memberId: "",
    memberName: "",
    type: "General",
    severity: "Low",
    date: "",
    description: "",
    status: "Open",
  });

  /* =========================
     LOAD INCIDENTS
  ========================= */

  useEffect(() => {
    const incidentQuery = query(
      collection(db, "incidents"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      incidentQuery,
      (snapshot) => {
        const incidentsData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setIncidents(incidentsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading incidents:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /* =========================
     LOAD MEMBERS
  ========================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "members"),
      (snapshot) => {
        const membersData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        membersData.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );

        setMembers(membersData);
        setMembersLoading(false);
      },
      (error) => {
        console.error("Error loading members:", error);
        setMembersLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /* =========================
     FORM HANDLERS
  ========================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "memberId") {
      const selectedMember = members.find(
        (member) => member.id === value,
      );

      setFormData((prev) => ({
        ...prev,
        memberId: value,
        memberName: selectedMember?.name || "",
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================
     OPEN ADD MODAL
     ADMIN + STAFF
  ========================= */

  const handleAddIncident = () => {
    setEditingIncident(null);

    setFormData({
      title: "",
      memberId: "",
      memberName: "",
      type: "General",
      severity: "Low",
      date: new Date().toISOString().split("T")[0],
      description: "",
      status: "Open",
    });

    setShowModal(true);
  };

  /* =========================
     OPEN EDIT MODAL
     ADMIN + STAFF
  ========================= */

  const handleEditIncident = (incident) => {
    setEditingIncident(incident);

    setFormData({
      title: incident.title || "",
      memberId: incident.memberId || "",
      memberName: incident.memberName || "",
      type: incident.type || "General",
      severity: incident.severity || "Low",
      date: incident.date || "",
      description: incident.description || "",
      status: incident.status || "Open",
    });

    setShowModal(true);
  };

  /* =========================
     SAVE INCIDENT
     ADMIN + STAFF
  ========================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      alert("Please enter an incident title.");
      return;
    }

    if (!formData.memberId) {
      alert("Please select a member.");
      return;
    }

    try {
      if (editingIncident) {
        await updateDoc(
          doc(db, "incidents", editingIncident.id),
          {
            title: formData.title.trim(),
            memberId: formData.memberId,
            memberName: formData.memberName,
            type: formData.type,
            severity: formData.severity,
            date: formData.date,
            description: formData.description.trim(),
            status: formData.status,
          },
        );
      } else {
        await addDoc(collection(db, "incidents"), {
          title: formData.title.trim(),
          memberId: formData.memberId,
          memberName: formData.memberName,
          type: formData.type,
          severity: formData.severity,
          date: formData.date,
          description: formData.description.trim(),
          status: formData.status,
          createdAt: serverTimestamp(),
        });
      }

      setShowModal(false);
      setEditingIncident(null);
    } catch (error) {
      console.error("Error saving incident:", error);
      alert("Failed to save incident.");
    }
  };

  /* =========================
     DELETE INCIDENT
     ADMIN ONLY
  ========================= */

  const handleDeleteIncident = async (id) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this incident?",
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "incidents", id));
    } catch (error) {
      console.error("Error deleting incident:", error);
      alert("Failed to delete incident.");
    }
  };

  /* =========================
     SEARCH
  ========================= */

  const filteredIncidents = incidents.filter((incident) => {
    const searchText = search.toLowerCase();

    return (
      incident.title?.toLowerCase().includes(searchText) ||
      incident.memberName?.toLowerCase().includes(searchText) ||
      incident.type?.toLowerCase().includes(searchText) ||
      incident.severity?.toLowerCase().includes(searchText) ||
      incident.status?.toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="incidents-page">
      {/* HEADER */}

      <div className="incidents-header">
        <div>
          <h1>Incidents</h1>
          <p>Manage and monitor gym-related incidents.</p>
        </div>

        {/* Admin + Staff */}
        <button
          className="add-incident-btn"
          onClick={handleAddIncident}
        >
          + Add Incident
        </button>
      </div>

      {/* INCIDENT CARD */}

      <div className="incidents-card">
        <div className="incidents-card-header">
          <div>
            <h2>Incident Records</h2>
            <p>View reported incidents and their current status.</p>
          </div>

          <input
            type="text"
            placeholder="Search incidents..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Member</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="incident-message"
                  >
                    Loading incidents...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="incident-message"
                  >
                    No incidents found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td>
                      <strong>{incident.title}</strong>
                    </td>

                    <td>{incident.memberName || "-"}</td>

                    <td>{incident.type || "-"}</td>

                    <td>
                      <span
                        className={`incident-severity ${incident.severity
                          ?.toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {incident.severity}
                      </span>
                    </td>

                    <td>{incident.date || "-"}</td>

                    <td>
                      <span
                        className={`incident-status ${incident.status
                          ?.toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {incident.status}
                      </span>
                    </td>

                    <td>
                      {/* Admin + Staff can edit */}
                      <button
                        className="edit-btn"
                        onClick={() =>
                          handleEditIncident(incident)
                        }
                      >
                        Edit
                      </button>

                      {/* Admin only */}
                      {isAdmin && (
                        <button
                          className="delete-btn"
                          onClick={() =>
                            handleDeleteIncident(incident.id)
                          }
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}

      {showModal && (
        <div className="modal-overlay">
          <div className="incident-modal">
            <div className="modal-header">
              <h2>
                {editingIncident
                  ? "Edit Incident"
                  : "Add Incident"}
              </h2>

              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Incident Title</label>

                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter incident title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Member</label>

                <select
                  name="memberId"
                  value={formData.memberId}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    {membersLoading
                      ? "Loading members..."
                      : "Select a member"}
                  </option>

                  {members.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Incident Type</label>

                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="General">General</option>
                  <option value="Equipment">
                    Equipment
                  </option>
                  <option value="Behavior">
                    Behavior
                  </option>
                  <option value="Safety">Safety</option>
                  <option value="Facility">
                    Facility
                  </option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Severity</label>

                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleChange}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">
                    Critical
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>Date</label>

                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe what happened..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Status</label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Open">Open</option>
                  <option value="Resolved">
                    Resolved
                  </option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                >
                  {editingIncident
                    ? "Update Incident"
                    : "Save Incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Incidents;