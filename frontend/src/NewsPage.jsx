// frontend/src/NewsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCrosshairs,
  FaChartLine,
  FaSignOutAlt,
  FaHome,
  FaNewspaper,
  FaGraduationCap
} from "react-icons/fa";
import "./Dashboard.css";
import "./NewsPage.css";

export default function NewsPage() {
  const token = localStorage.getItem("token");
  const isLoggedIn = !!token;
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role;
  const isAdmin = role === "admin";

  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/dashboard");
  };

  useEffect(() => {
    fetch("http://localhost:4000/api/news?q=phishing")
      .then((res) => res.json())
      .then((data) => {
        // Ensure data is always an array
        setArticles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load news:", err);
        setArticles([]);
        setLoading(false);
      });
  }, []);

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
        {isAdmin && (
          <div
            className="sidebar-item"
            onClick={() => navigate("/target-profiles")}
          >
            <FaCrosshairs className="icon" />
            <span className="label">Target Profiles</span>
          </div>
        )}
        {isAdmin && (
          <div className="sidebar-item">
            <FaChartLine className="icon" />
            <span className="label">Analytics</span>
          </div>
        )}
          <div className="sidebar-item active" onClick={() => navigate("/news")}>
            <FaNewspaper className="icon" />
            <span className="label">News</span>
          </div>
        {!isLoggedIn && (
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

      {/* Main Content */}
      <div className="dashboard-main">
        <h1 className="news-header">Phishing News</h1>

        {loading ? (
          <p className="loading-text">Loading latest headlines...</p>
        ) : (
          <div className="news-grid">
            {articles.map((article, index) => (
              <div key={index} className="news-card">
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="news-image"
                  />
                )}
                <div className="news-content">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-link"
                  >
                    <h3 className="news-title">{article.title}</h3>
                  </a>
                  {article.description && (
                    <p className="news-description">{article.description}</p>
                  )}
                  <p className="news-meta">
                    {article.source} •{" "}
                    {new Date(article.published).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
