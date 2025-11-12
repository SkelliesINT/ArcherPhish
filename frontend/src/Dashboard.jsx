// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState(""); // Success message
  const [emailError, setEmailError] = useState("");     // Error message
  const navigate = useNavigate();

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
        setNewEmail(""); // Clear input
      })
      .catch((err) => {
        setEmailError(err.response?.data?.error || "Failed to add email");
      });
  };

  const handleCreateCampaign = () => {
    // Navigate to a create campaign page (you can create this route/component)
    navigate("/create-campaign");
  };

  return (
    <div className="ap-page">
      <div className="ap-card" style={{ flexDirection: "column", maxWidth: "600px", padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
          <img src="/logo.png" alt="ArcherPhish logo" className="ap-logo" style={{ marginRight: "16px" }} />
          <h1>Dashboard</h1>
        </div>

        <p style={{ color: "#dffcff", fontSize: "16px" }}>{message}</p>

        {/* Inline New Email input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
          <small style={{ color: "#dffcff" }}>Add recipient email:</small>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="example@domain.com"
              style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.03)", color: "#e8eef1" }}
            />
            <button type="button" className="ap-button" onClick={handleAddEmail}>
              Add
            </button>
          </div>
          {emailMessage && <p style={{ color: "#66ff99" }}>{emailMessage}</p>}
          {emailError && <p style={{ color: "#ff9a9a" }}>{emailError}</p>}
        </div>

        {/* Create Campaign button */}
        <button className="ap-button" onClick={handleCreateCampaign} style={{ marginTop: "20px", width: "180px" }}>
          Create Campaign
        </button>

        {/* Logout button */}
        <button className="ap-button" onClick={handleLogout} style={{ marginTop: "12px", width: "140px" }}>
          Logout
        </button>
      </div>
    </div>
  );
}
