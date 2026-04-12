// frontend/src/Dashboard.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import "./Dashboard.css";
import "./index.css";
import Sidebar from "./Sidebar";
import { useAuth } from "./AuthContext";

export default function Dashboard() {
  const [message, setMessage] = useState("Welcome back!");
  const [topNews, setTopNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [daysSinceLastCampaign, setDaysSinceLastCampaign] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentCampaign, setRecentCampaign] = useState(null);
  const [totalRecipients, setTotalRecipients] = useState(null);
  const navigate = useNavigate();
  const { user, permissions, setUser } = useAuth();
  const isLoggedIn = !!user;
  const canViewAnalytics =
  permissions.includes("view_all_analytics") ||
  permissions.includes("view_at_risk_analytics") ||
  permissions.includes("view_department_analytics");

  const getDaysColor = (days) => {
    if (days === null) return "#aaa";
    if (days <= 30) return "#4caf50";
    if (days <= 160) return "#ffeb3b";
    return "#f44336";
  };

  // Auth / welcome message
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null); // update AuthContext
      setMessage("Welcome! Please log in to access full features.");
      return;
    }

    axios
      .get("http://localhost:4000/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        // If API returns user info, store it in context
        setUser(res.data.user);
        setMessage(res.data.message);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null); // not logged in
        setMessage("Welcome! Please log in.");
      });
  }, []);

  // Campaigns: days since last, stats, recent campaign
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios.get("http://localhost:4000/api/campaigns", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        const data = res.data || [];
        setCampaigns(data);

        if (data.length > 0) {
          const lastDate = new Date(data[0].created_at);
          const today = new Date();
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
          const days = Math.round((todayMidnight - lastMidnight) / (1000 * 60 * 60 * 24));
          setDaysSinceLastCampaign(days);
          setRecentCampaign(data[0]);
        } else {
          setDaysSinceLastCampaign(null);
          setRecentCampaign(null);
        }

        const totalEmailsSent = data.reduce((sum, c) => sum + (Number(c.emails_sent) || 0), 0);
        const totalClicks = data.reduce((sum, c) => sum + (Number(c.total_clicks) || 0), 0);
        const overallClickRate = totalEmailsSent > 0
          ? Math.round((totalClicks / totalEmailsSent) * 100)
          : 0;

        setStats({
          totalCampaigns: data.length,
          totalEmailsSent,
          overallClickRate,
        });
      })
      .catch(err => console.error("Failed to load campaigns:", err));
  }, []);

  // Total recipients count
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    axios.get("http://localhost:4000/api/recipients", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setTotalRecipients(res.data.length))
      .catch(() => setTotalRecipients(null));
  }, []);

  // Top phishing news
  useEffect(() => {
    axios.get("http://localhost:4000/api/news?q=phishing")
      .then(res => {
        setTopNews(res.data.filter(a => a.image).slice(0, 3));
        setLoadingNews(false);
      })
      .catch(err => {
        console.error("Failed to load top news:", err);
        setLoadingNews(false);
      });
  }, []);

  const recentClickRate = recentCampaign && Number(recentCampaign.emails_sent) > 0
    ? Math.round((Number(recentCampaign.total_clicks) / Number(recentCampaign.emails_sent)) * 100)
    : 0;

  // Click rate trend — chronological order, last 6 campaigns
  const trendChartData = [...campaigns].reverse().slice(-6).map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
    Rate: Number(c.emails_sent) > 0
      ? Math.round((Number(c.total_clicks) / Number(c.emails_sent)) * 100)
      : 0,
  }));

  const trendInfo = (() => {
    if (campaigns.length < 2) return null;
    const recent = campaigns.slice(0, Math.min(3, campaigns.length));
    const rateOf = c => Number(c.emails_sent) > 0
      ? (Number(c.total_clicks) / Number(c.emails_sent)) * 100
      : 0;
    const newestRate = rateOf(recent[0]);
    const oldestRate = rateOf(recent[recent.length - 1]);
    const diff = newestRate - oldestRate;
    if (Math.abs(diff) < 1) return { label: "Stable", arrow: "→", color: "#aaa", diff: 0 };
    if (diff < 0) return { label: "Improving", arrow: "↓", color: "#4caf50", diff: Math.abs(diff).toFixed(1) };
    return { label: "Worsening", arrow: "↑", color: "#f44336", diff: diff.toFixed(1) };
  })();

  return (
    <div className="dashboard-container">
      <Sidebar />

      <div className="dashboard-main">
        <h1>Dashboard</h1>
        <p className="dashboard-message">{message}</p>

        {!isLoggedIn && (
          <div className="guest-info">
            <p>
              You are currently browsing as a guest.
              Log in to create campaigns and view analytics.
            </p>
          </div>
        )}

        {/* Campaign Overview + Trend Row */}
        {isLoggedIn && permissions.includes("view_campaigns") && (
          <div className="dashboard-top-row">

            {/* Campaign Overview Widget */}
            <div className="campaign-overview-widget">
              <p className="cow-header">Campaign Overview</p>
              <div className="cow-body">
                <div className="cow-left">
                  <div>
                    <p
                      className="cow-days-number"
                      style={{ color: getDaysColor(daysSinceLastCampaign) }}
                    >
                      {daysSinceLastCampaign !== null ? daysSinceLastCampaign : "—"}
                    </p>
                    <p className="cow-days-label">Days Since Last Campaign</p>
                  </div>
                  {permissions.includes("create_campaign") && (
                  <button className="cow-launch-btn" onClick={() => navigate("/create-campaign")}>
                    Launch Campaign →
                  </button>
                  )}
                </div>

                {stats && (
                  <>
                    <div className="cow-vdivider" />
                    <div className="cow-stats">
                      <div className="cow-stat">
                        <p className="cow-stat-value">{stats.totalCampaigns}</p>
                        <p className="cow-stat-label">Campaigns</p>
                      </div>
                      <div className="cow-stat">
                        <p className="cow-stat-value">{stats.totalEmailsSent}</p>
                        <p className="cow-stat-label">Emails Sent</p>
                      </div>
                      <div className="cow-stat">
                        <p className="cow-stat-value">{stats.overallClickRate}%</p>
                        <p className="cow-stat-label">Click Rate</p>
                      </div>
                      <div className="cow-stat">
                        <p className="cow-stat-value">{totalRecipients ?? "—"}</p>
                        <p className="cow-stat-label">Recipients</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Click Rate Trend Widget */}
            <div className="trend-widget">
              <p className="cow-header">Click Rate Trend</p>
              {trendInfo ? (
                <div className="trend-widget-indicator">
                  <span className="trend-widget-arrow" style={{ color: trendInfo.color }}>
                    {trendInfo.arrow}
                  </span>
                  <span className="trend-widget-label" style={{ color: trendInfo.color }}>
                    {trendInfo.label}
                  </span>
                  {trendInfo.diff > 0 && (
                    <span className="trend-widget-diff">
                      ({trendInfo.diff}pp over last {Math.min(3, campaigns.length)} campaigns)
                    </span>
                  )}
                </div>
              ) : (
                <p className="trend-widget-empty">
                  {campaigns.length === 0 ? "No campaigns yet" : "Send more campaigns to see a trend"}
                </p>
              )}
              {campaigns.length > 0 && (
                <div className="trend-widget-chart">
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={trendChartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e26" />
                      <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#666", fontSize: 10 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e1e26", border: "1px solid #444", borderRadius: "8px" }}
                        labelStyle={{ color: "#fff" }}
                        itemStyle={{ color: "#ddd" }}
                        formatter={(val) => [`${val}%`, "Click Rate"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="Rate"
                        stroke="#00e5ff"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#00e5ff" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Most Recent Campaign */}
        {isLoggedIn && permissions.includes("view_campaigns") && recentCampaign && (
          <div className="recent-campaign-card">
            <p className="recent-campaign-header">Most Recent Campaign</p>
            <p className="recent-campaign-name">{recentCampaign.name}</p>
            <div className="recent-campaign-stats">
              <div className="recent-stat">
                <span className="recent-stat-value">{recentCampaign.emails_sent ?? 0}</span>
                <span className="recent-stat-label">Sent</span>
              </div>
              <div className="recent-stat">
                <span className="recent-stat-value">{recentCampaign.total_clicks ?? 0}</span>
                <span className="recent-stat-label">Clicks</span>
              </div>
              <div className="recent-stat">
                <span className="recent-stat-value">{recentClickRate}%</span>
                <span className="recent-stat-label">Click Rate</span>
              </div>
              <div className="recent-stat">
                <span className="recent-stat-value">
                  {new Date(recentCampaign.created_at).toLocaleDateString()}
                </span>
                <span className="recent-stat-label">Date</span>
              </div>
            </div>
            {canViewAnalytics && (
            <button
              className="recent-campaign-link"
              onClick={() => navigate("/analytics")}
            >
              View in Analytics →
            </button>
            )}
          </div>
        )}

        {/* Top Phishing News */}
        <section className="dashboard-news-section">
          <h2>Top Phishing News</h2>
          {loadingNews ? (
            <p>Loading news...</p>
          ) : (
            <div className="top-news-list">
              {topNews.map((article, index) => (
                <a
                  key={index}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="top-news-item"
                >
                  {article.image && (
                    <img
                      src={article.image}
                      alt={article.title}
                      className="top-news-thumbnail"
                    />
                  )}
                  <div className="top-news-text">
                    <p className="top-news-title">{article.title}</p>
                    <p className="top-news-source">
                      {article.source} • {new Date(article.published).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
