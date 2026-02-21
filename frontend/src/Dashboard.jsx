// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaNewspaper } from "react-icons/fa"; // Icons
import "./Dashboard.css";
import "./index.css";
import Sidebar from "./Sidebar";

export default function Dashboard() {
  const [message, setMessage] = useState("Welcome back!");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const navigate = useNavigate();

  // 🔹 Analytics state
  const [links, setLinks] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [analytics, setAnalytics] = useState({
    link: null,
    totalClicks: 0,
    uniqueUsers: 0,
    perDay: {},
    uaCounts: {},
  });
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  // 🔹 Create-link modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkName, setNewLinkName] = useState("");
  const [createLinkError, setCreateLinkError] = useState("");
  const [createLinkLoading, setCreateLinkLoading] = useState(false);

  // Existing auth / welcome message
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    axios
      .get("http://localhost:4000/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMessage(res.data.message))
      .catch((err) => {
        setMessage(err.response?.data?.error || "Error");
        localStorage.removeItem("token");
        navigate("/");
      });
  }, [navigate]);

  // Load links for analytics on mount
  useEffect(() => {
    axios
      .get("http://localhost:4000/api/links")
      .then((res) => {
        const obj = res.data || {};
        setLinks(Object.values(obj));
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  useEffect(() => {
  axios
    .get("http://localhost:4000/api/recipients")
    .then((res) => setRecipients(res.data))
    .catch((err) => console.error("Failed to load recipients", err));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleAddEmail = () => {
    setEmailMessage("");
    setEmailError("");

    if (!newEmail) return setEmailError("Email cannot be empty");

    axios
      .post("http://localhost:4000/api/recipients", { email: newEmail })
      .then((res) => {
        setEmailMessage(res.data.message);
        setNewEmail("");
      })
      .catch((err) => {
        setEmailError(err.response?.data?.error || "Failed to add email");
      });
  };

  const handleCreateCampaign = () => {
    navigate("/create-campaign");
  };

  // Load analytics for a specific short link
  const handleViewAnalytics = async (linkId) => {
    setSelectedLinkId(linkId);

    // ✅ Safe reset BEFORE loading
    setAnalytics({
      link: null,
      totalClicks: 0,
      uniqueUsers: 0,
      perDay: {},
      uaCounts: {},
    });

    setAnalyticsError("");
    setLoadingAnalytics(true);

    try {
      const res = await axios.get(
        `http://localhost:4000/api/analytics/${linkId}`
      );

      // ✅ Normalize response AFTER loading
      setAnalytics({
        link: res.data.link || null,
        totalClicks: res.data.totalClicks || 0,
        uniqueUsers: res.data.uniqueUsers || 0,
        perDay: res.data.perDay || {},
        uaCounts: res.data.uaCounts || {},
      });
    } catch (err) {
      console.error(err);
      setAnalyticsError(err.response?.data?.error || "Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // 🔹 Create-link modal helpers
  const openCreateModal = () => {
    setCreateLinkError("");
    setSelectedRecipient("");
    setNewLinkUrl("");
    setNewLinkName("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createLinkLoading) return;
    setIsCreateModalOpen(false);
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    setCreateLinkError("");

    if (!newLinkUrl.trim()) {
      setCreateLinkError("Target URL is required.");
      return;
    }

    if (!selectedRecipient) {
      setCreateLinkError("Please select a recipient.");
      return;
    }
    setCreateLinkLoading(true);
    try {
      const res = await axios.post("http://localhost:4000/api/links", {
        url: newLinkUrl.trim(),
        name: newLinkName.trim() || null,
        recipient_id: selectedRecipient,
      });

      const created = res.data; // { id, shortUrl, target }

      // Add new link into list so it shows in the left panel
      setLinks((prev) => [
        ...prev,
        {
          id: created.id,
          url: created.target,
          name: newLinkName.trim() || null,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Auto-select and load analytics for the new link
      handleViewAnalytics(created.id);

      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      setCreateLinkError(
        err.response?.data?.error || "Failed to create tracking link"
      );
    } finally {
      setCreateLinkLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar />

      {/* Main content */}
      <div className="dashboard-main">
        <h1>Dashboard</h1>
        <p className="dashboard-message">{message}</p>

        <div className="dashboard-actions">
          <button className="ap-button" onClick={handleCreateCampaign}>
            Create Campaign
          </button>
          <button
            className="ap-button ap-button-secondary"
            onClick={openCreateModal}
          >
            Create Tracking Link
          </button>
        </div>

        {/* Analytics Section */}
        <section className="analytics-section">
          <h2 className="analytics-title">Link Analytics</h2>

          <div className="analytics-layout">
            {/* Left: list of links */}
            <div className="analytics-list-card">
              <h3 className="analytics-subtitle">Tracked Links</h3>
              {links.length === 0 && (
                <p className="analytics-muted">No tracking links created yet.</p>
              )}

              <ul className="analytics-list">
                {links.map((link) => (
                  <li
                    key={link.id}
                    className={
                      "analytics-list-item" +
                      (selectedLinkId === link.id ? " selected" : "")
                    }
                  >
                    <div className="analytics-link-main">
                      <span className="analytics-link-name">
                        {link.name || link.url}
                      </span>
                      <span className="analytics-link-id">ID: {link.id}</span>
                    </div>
                    <button
                      className="analytics-button"
                      onClick={() => handleViewAnalytics(link.id)}
                    >
                      View Analytics
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: details for selected link */}
            <div className="analytics-details-card">
              <h3 className="analytics-subtitle">Details</h3>

              {loadingAnalytics && (
                <p className="analytics-muted">Loading analytics...</p>
              )}

              {analyticsError && <p className="error">{analyticsError}</p>}

              {!loadingAnalytics && !analytics && !analyticsError && (
                <p className="analytics-muted">
                  Select a link on the left to view analytics.
                </p>
              )}

              {analytics.link && !loadingAnalytics && (
                <div className="analytics-details">

                  <p>
                    <span className="analytics-label">Campaign:</span>{" "}
                    <span className="analytics-value">
                      {analytics.link.name || "Unnamed campaign"}
                    </span>
                  </p>

                  <p>
                    <span className="analytics-label">Employee:</span>{" "}
                    <span className="analytics-value">
                      {analytics.link.employee}
                    </span>
                  </p>

                  <p>
                    <span className="analytics-label">Tracking Link:</span>{" "}
                    <span className="analytics-value">
                      http://localhost:4000/r/{analytics.link.id}
                    </span>
                  </p>

                  <p>
                    <span className="analytics-label">Total Clicks:</span>{" "}
                    <span className="analytics-value">
                      {analytics.totalClicks}
                    </span>
                  </p>

                  <p>
                    <span className="analytics-label">Unique Users:</span>{" "}
                    <span className="analytics-value">
                      {analytics.uniqueUsers}
                    </span>
                  </p>

                  {/* ✅ Simple pass/fail interpretation */}
                  <p>
                    <span className="analytics-label">Result:</span>{" "}
                    <span
                      className={
                        analytics.totalClicks > 0
                          ? "analytics-fail"
                          : "analytics-pass"
                      }
                    >
                      {analytics.totalClicks > 0 ? "Clicked (Fail)" : "No Clicks (Pass)"}
                    </span>
                  </p>

                  <div className="analytics-grid">
                    <div>
                      <h4>Clicks Per Day</h4>
                      {Object.keys(analytics.perDay).length === 0 ? (
                        <p className="analytics-muted">No click data yet.</p>
                      ) : (
                        <ul className="analytics-mini-list">
                          {Object.entries(analytics.perDay).map(([day, count]) => (
                            <li key={day}>
                              {day}: {count}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h4>User Agents</h4>
                      {Object.keys(analytics.uaCounts).length === 0 ? (
                        <p className="analytics-muted">No user agent data.</p>
                      ) : (
                        <ul className="analytics-mini-list">
                          {Object.entries(analytics.uaCounts).map(([ua, count]) => (
                            <li key={ua}>
                              {ua}: {count}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* 🔹 Create Tracking Link Modal */}
        {isCreateModalOpen && (
          <div className="modal-backdrop" onClick={closeCreateModal}>
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Create Tracking Link</h3>
              <form className="modal-form" onSubmit={handleCreateLink}>
                <label>
                  Target URL
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                  />
                </label>

                <label>
                  Recipient
                  <select
                    value={selectedRecipient}
                    onChange={(e) => setSelectedRecipient(e.target.value)}
                    required
                  >
                    <option value="">Select a recipient</option>
                    {recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.firstName} {r.lastName} ({r.email})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Link Name (optional)
                  <input
                    type="text"
                    placeholder="Internal name for this link"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                  />
                </label>

                {createLinkError && (
                  <p className="error" style={{ marginTop: "4px" }}>
                    {createLinkError}
                  </p>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-button ghost"
                    onClick={closeCreateModal}
                    disabled={createLinkLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="modal-button primary"
                    disabled={createLinkLoading}
                  >
                    {createLinkLoading ? "Creating..." : "Create Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
