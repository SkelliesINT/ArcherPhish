// frontend/src/NewsPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaTachometerAlt, FaNewspaper, FaGraduationCap } from "react-icons/fa";
import "./Dashboard.css"; // Reuse your dashboard/sidebar styles
import './index.css';

export default function NewsPage() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const isLoggedIn = !!token;

  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;
  const isAdmin = role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/dashboard";
  };

  return (
    <div className="sidebar">
          <div className="sidebar-logo">
            <img src="/logo2.png" alt="ArcherPhish logo" className="logo-part1" />
            <img src="/logo3.png" alt="ArcherPhish logo" className="logo-part2"/>
          </div>
    
          <div className="sidebar-icons">
          {/* Dashboard */}
            <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
              <FaTachometerAlt className="icon" />
              <span className="label">Dashboard</span>
            </div>
    
            {isAdmin && (
              <div className="sidebar-item" onClick={() => navigate("/target-profiles")}>
                <FaCrosshairs className="icon" />
                <span className="label">Target Profiles</span>
              </div>
            )}
    
            {isAdmin && (
              <div className="sidebar-item" onClick={() => navigate("/analytics")}>
                <FaChartLine className="icon" />
                <span className="label">Analytics</span>
              </div>
            )}
    
            <div className="sidebar-item" onClick={() => navigate("/news")}>
              <FaNewspaper className="icon" />
              <span className="label">News</span>
            </div>
    
            {!isAdmin && (
              <div className="sidebar-item" onClick={() => navigate("/training")}>
                <FaGraduationCap className="icon" />
                <span className="label">Training</span>
              </div>
            )}
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
