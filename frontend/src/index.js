import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import CreateCampaign from "./CreateCampaign";
import TargetProfiles from "./TargetProfiles";
import NewsPage from './NewsPage';
import Analytics from "./Analytics";
import Training from "./Training";

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user, permissions } = useAuth();

  if (!user) return <Navigate to="/login" />; // Not logged in
  if (requiredPermission && !permissions.includes(requiredPermission))
    return <div>403 - Forbidden</div>; // No permission

  return children;
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/training" element={<Training />} />
          <Route path="/login" element={<Login />} />
          {/* Protected routes */}
          <Route
            path="/create-campaign"
            element={
              <ProtectedRoute requiredPermission="create_campaign">
                <CreateCampaign />
              </ProtectedRoute>
            }
          />
          <Route
            path="/target-profiles"
            element={
              <ProtectedRoute requiredPermission="view_recipients">
                <TargetProfiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requiredPermission="view_all_analytics">
                <Analytics />
              </ProtectedRoute>
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);