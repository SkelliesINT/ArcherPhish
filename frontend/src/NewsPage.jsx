// frontend/src/NewsPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaHome, FaNewspaper } from "react-icons/fa";
import "./Dashboard.css"; // Reuse your dashboard/sidebar styles
import './index.css';

export default function NewsPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo2.png" alt="Logo part 1" className="logo-part1" />
          <img src="/logo3.png" alt="Logo part 2" className="logo-part2" />
        </div>

        <div className="sidebar-icons">
          <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
            <FaHome className="icon" />
            <span className="label">Dashboard</span>
          </div>

          <div className="sidebar-item" onClick={() => navigate("/target-profiles")}>
            <FaCrosshairs className="icon" />
            <span className="label">Target Profiles</span>
          </div>

          <div className="sidebar-item">
            <FaChartLine className="icon" />
            <span className="label">Analytics</span>
          </div>

          <div className="sidebar-item" onClick={() => navigate("/news")}>
            <FaNewspaper className="icon" />
            <span className="label">News</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item" onClick={handleLogout}>
            <FaSignOutAlt className="icon" />
            <span className="label">Logout</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="dashboard-main">
        <h1>News</h1>
        <p>Here you can display news, updates, or announcements.</p>
      </div>
    </div>
  );
}
