import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ allowedRoles }) {
  const {
    user,
    userProfile,
    loading,
  } = useAuth();

  // Wait until Firebase finishes checking the user
  if (loading) {
    return (
      <div className="auth-loading">
        Loading...
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Firebase account exists but no Bizyo profile
  if (!userProfile) {
    return <Navigate to="/" replace />;
  }

  // Check role if specific roles are required
  if (
    allowedRoles &&
    !allowedRoles.includes(userProfile.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;