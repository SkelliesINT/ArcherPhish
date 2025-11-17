// frontend/src/Sidebar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaTachometerAlt, FaNewspaper } from "react-icons/fa"; // added FaTachometerAlt for dashboard icon
import "./Dashboard.css";

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo2.png" alt="ArcherPhish logo" className="logo-part1" />
        <img src="/logo3.png" alt="ArcherPhish logo" className="logo-part2"/>
      </div>

      <div className="sidebar-icons">
        {/* Dashboard button */}
        <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
          <FaTachometerAlt className="icon" />
          <span className="label">Dashboard</span>
        </div>

        {/* Target Profiles */}
        <div className="sidebar-item" onClick={() => navigate("/target-profiles")}>
          <FaCrosshairs className="icon" />
          <span className="label">Target Profiles</span>
        </div>

        {/* Analytics */}
        <div className="sidebar-item">
          <FaChartLine className="icon" />
          <span className="label">Analytics</span>
        </div>

        <div className="sidebar-item" onClick={() => navigate("/news")}>
            <FaNewspaper className="icon" />
  <         span className="label">News</span>
        </div>

      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-item" onClick={handleLogout}>
          <FaSignOutAlt className="icon" />
          <span className="label">Logout</span>
        </div>
      </div>
    </div>
  );
}
