import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Memberships from "./pages/Memberships";
import DashboardLayout from "./layouts/DashboardLayout";
import Payments from "./pages/Payments";
import EntryLog from "./pages/EntryLog";
import Equipment from "./pages/Equipment";
import Incidents from "./pages/Incidents";
import RestrictedMembers from "./pages/RestrictedMembers";
import ActivityLogs from "./pages/ActivityLogs";
import MembershipExpiration from "./pages/MembershipExpiration";
import StaffAccounts from "./pages/StaffAccounts";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* =========================================
            LOGIN
        ========================================= */}
        <Route path="/" element={<Login />} />

        {/* =========================================
            LOGGED-IN USERS
        ========================================= */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>

            {/* =====================================
                ADMIN + STAFF
            ===================================== */}

            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/members"
              element={<Members />}
            />

            <Route
              path="/memberships"
              element={<Memberships />}
            />

            <Route
              path="/entry-log"
              element={<EntryLog />}
            />

            <Route
              path="/payments"
              element={<Payments />}
            />

            <Route
              path="/equipment"
              element={<Equipment />}
            />

            <Route
              path="/incidents"
              element={<Incidents />}
            />

            <Route
              path="/restricted-members"
              element={<RestrictedMembers />}
            />

            <Route
              path="/membership-expiration"
              element={<MembershipExpiration />}
            />

            {/* =====================================
                ADMIN ONLY
            ===================================== */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["admin"]} />
              }
            >
              <Route
                path="/activity-logs"
                element={<ActivityLogs />}
              />

              <Route
                path="/staff-accounts"
                element={<StaffAccounts />}
              />
            </Route>

          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;