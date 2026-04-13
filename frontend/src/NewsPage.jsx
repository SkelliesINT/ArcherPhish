// frontend/src/NewsPage.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { API_BASE } from './config';
import "./Dashboard.css";
import "./NewsPage.css";

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/news?q=phishing`)
      .then((res) => res.json())
      .then((data) => {
        setArticles(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load news:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar />

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
