import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

function DashboardLayout() {
  return (
    <div className="dashboard">
      <Sidebar />

      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;