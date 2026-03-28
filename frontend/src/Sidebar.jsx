// frontend/src/Sidebar.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaCrosshairs,
  FaChartLine,
  FaSignOutAlt,
  FaTachometerAlt,
  FaNewspaper,
  FaGraduationCap
} from "react-icons/fa";
import "./Dashboard.css";
import { useAuth } from "./AuthContext";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation(); // get current path
  const { user, permissions } = useAuth();

  const token = localStorage.getItem("token");
  const isLoggedIn = !!user;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/dashboard";
  };

  // Helper to determine if a route is active
  const isActive = (path) => location.pathname === path;

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo2.png" alt="ArcherPhish logo" className="logo-part1" />
        <img src="/logo3.png" alt="ArcherPhish logo" className="logo-part2"/>
      </div>

      <div className="sidebar-icons">
        {/* Dashboard button */}
        <div
          className={`sidebar-item ${isActive("/dashboard") ? "active" : ""}`}
          onClick={() => navigate("/dashboard")}
        >
          <FaTachometerAlt className="icon" />
          <span className="label">Dashboard</span>
        </div>

        {/* Target Profiles */}
        {permissions.includes("view_recipients") && (
        <div
          className={`sidebar-item ${isActive("/target-profiles") ? "active" : ""}`}
          onClick={() => navigate("/target-profiles")}
        >
          <FaCrosshairs className="icon" />
          <span className="label">Target Profiles</span>
        </div>
        )}

        {/* Analytics */}
        {permissions.includes("view_all_analytics") && (
        <div
          className={`sidebar-item ${isActive("/analytics") ? "active" : ""}`}
          onClick={() => navigate("/analytics")}
        >
          <FaChartLine className="icon" />
          <span className="label">Analytics</span>
        </div>
        )}

        {/* News */}
        <div
          className={`sidebar-item ${isActive("/news") ? "active" : ""}`}
          onClick={() => navigate("/news")}
        >
          <FaNewspaper className="icon" />
          <span className="label">News</span>
        </div>

        {/* Training */}
        <div className={`sidebar-item ${isActive("/training") ? "active" : ""}`}
          onClick={() => navigate("/training")}>
        <FaGraduationCap className="icon" />
        <span className="label">Training</span>
       </div>
      </div>

       <div className="sidebar-bottom">
        {!isLoggedIn ? (
          <div className="sidebar-item" onClick={() => navigate("/login")}>
            <FaSignOutAlt className="icon" />
            <span className="label">Login</span>
          </div>
        ) : (
          <div className="sidebar-item" onClick={handleLogout}>
            <FaSignOutAlt className="icon" />
            <span className="label">Logout</span>
          </div>
        )}
      </div>
    </div>
  );
}
