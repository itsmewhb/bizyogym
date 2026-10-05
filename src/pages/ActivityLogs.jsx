import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import "./ActivityLogs.css";

function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /*
   * Load Activity Logs
   */
  useEffect(() => {
    const logsQuery = query(
      collection(db, "activityLogs"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const logsData = snapshot.docs.map((logDoc) => ({
          id: logDoc.id,
          ...logDoc.data(),
        }));

        setLogs(logsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading activity logs:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  /*
   * Format Date
   */
  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return "-";

    return timestamp.toDate().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  /*
   * Format Time
   */
  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return "-";

    return timestamp.toDate().toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  /*
   * Get User Role
   *
   * New activity logs:
   * - role === "staff" -> Staff
   * - role === "admin" -> Admin
   *
   * Older logs without a role:
   * - Use the existing user field
   * - Default to Admin
   */
  const getLogUser = (log) => {
    if (log.role === "staff") {
      return "Staff";
    }

    if (log.role === "admin") {
      return "Admin";
    }

    return log.user || "Admin";
  };

  /*
   * Search
   */
  const filteredLogs = logs.filter((log) => {
    const searchText = search.toLowerCase();

    return (
      (log.action || "").toLowerCase().includes(searchText) ||
      (log.description || "").toLowerCase().includes(searchText) ||
      getLogUser(log).toLowerCase().includes(searchText) ||
      (log.targetType || "").toLowerCase().includes(searchText)
    );
  });

  return (
    <div className="activity-logs-page">
      {/* Header */}
      <div className="activity-logs-header">
        <div>
          <h1>Activity Logs</h1>
          <p>
            Track important activities and changes made in the system.
          </p>
        </div>
      </div>

      {/* Activity Logs Card */}
      <div className="activity-logs-card">
        <div className="activity-logs-card-header">
          <div>
            <h2>System Activity</h2>
            <p>Recent actions performed in Bizyo.</p>
          </div>

          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="activity-loading">
            Loading activity logs...
          </p>
        ) : filteredLogs.length === 0 ? (
          <p className="activity-empty">
            No activity logs found.
          </p>
        ) : (
          <div className="activity-table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>User</th>
                  <th>Target</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    {/* Date & Time */}
                    <td>
                      <div className="activity-date">
                        {formatDate(log.createdAt)}
                      </div>

                      <div className="activity-time">
                        {formatTime(log.createdAt)}
                      </div>
                    </td>

                    {/* Action */}
                    <td>
                      <span
                        className={`activity-action ${
                          log.action
                            ?.toLowerCase()
                            .replace(/\s+/g, "-") || ""
                        }`}
                      >
                        {log.action || "Activity"}
                      </span>
                    </td>

                    {/* Description */}
                    <td>
                      <span className="activity-description">
                        {log.description || "-"}
                      </span>
                    </td>

                    {/* User */}
                    <td>
                      <span className="activity-user">
                        {getLogUser(log)}
                      </span>
                    </td>

                    {/* Target */}
                    <td>
                      <span className="activity-target">
                        {log.targetType || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityLogs;