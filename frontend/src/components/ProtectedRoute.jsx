import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap a route element with this to require login, and optionally
 * restrict it to specific roles, e.g.:
 *   <ProtectedRoute allowedRoles={["admin"]}><AIAssistant /></ProtectedRoute>
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Logged in, but not allowed to see this page — send to their home page
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
