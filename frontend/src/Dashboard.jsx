// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaNewspaper } from "react-icons/fa"; // Icons
import "./Dashboard.css"; // We'll create a new CSS file for dashboard
import './index.css';
import Sidebar from "./Sidebar";

export default function Dashboard() {
  const [message, setMessage] = useState("Welcome back!");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState(""); 
  const [emailError, setEmailError] = useState("");
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
        setNewEmail("");
      })
      .catch((err) => {
        setEmailError(err.response?.data?.error || "Failed to add email");
      });
  };

  const handleCreateCampaign = () => {
    navigate("/create-campaign");
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      {/* Main content */}
      <div className="dashboard-main">
        <h1>Dashboard</h1>
        <p className="dashboard-message">{message}</p>

        <button className="ap-button" onClick={handleCreateCampaign}>
          Create Campaign
        </button>
      </div>
    </div>
  );
}
