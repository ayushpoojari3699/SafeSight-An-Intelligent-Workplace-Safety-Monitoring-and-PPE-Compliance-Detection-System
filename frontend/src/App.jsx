import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppShell from "./layouts/AppShell";
import Dashboard from "./Dashboard";
import AIAssistant from "./pages/AIAssistant";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import AdminUploadCenter from "./pages/admin/AdminUploadCenter";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminDetections from "./pages/admin/AdminDetections";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSites from "./pages/admin/AdminSites";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute allowedRoles={["user", "admin"]}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          {/* Shared by both roles */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/assistant" element={<AIAssistant />} />

          {/* Admin-only workspace */}
          <Route
            path="/admin/upload"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminUploadCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDocuments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/detections"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDetections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sites"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSites />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
