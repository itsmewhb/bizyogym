import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

function Sidebar() {
  const navigate = useNavigate();
  const { userProfile, isAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <aside className="sidebar">

      {/* LOGO */}
      <div className="logo">
        <h2>BIZYO</h2>
        <span>GYM MANAGEMENT</span>
      </div>

      {/* NAVIGATION */}
      <nav className="sidebar-nav">

        <NavLink to="/dashboard">
          📊 <span>Dashboard</span>
        </NavLink>

        <NavLink to="/members">
          👥 <span>Members</span>
        </NavLink>

        <NavLink to="/memberships">
          💳 <span>Membership Plans</span>
        </NavLink>

        <NavLink to="/entry-log">
          🚪 <span>Entry Log</span>
        </NavLink>

        <NavLink to="/payments">
          💰 <span>Payments</span>
        </NavLink>

        <NavLink to="/equipment">
          🏋️ <span>Equipment</span>
        </NavLink>

        <NavLink to="/incidents">
          ⚠️ <span>Incidents</span>
        </NavLink>

        <NavLink to="/restricted-members">
          🚫 <span>Restricted Members</span>
        </NavLink>
        
        <NavLink to="/membership-expiration">
          ⏰ <span>Plan Expiration</span>
        </NavLink>

        {isAdmin && (
          <>
            <NavLink to="/staff-accounts">
              👤 <span>Staff Accounts</span>
            </NavLink>

            <NavLink to="/activity-logs">
              📋 <span>Activity Logs</span>
            </NavLink>
          </>
        )}

      </nav>

      {/* LOGOUT */}
      <button
        className="logout-btn"
        onClick={handleLogout}
      >
        ➜] <span>Logout</span>
      </button>

    </aside>
  );
}

export default Sidebar;