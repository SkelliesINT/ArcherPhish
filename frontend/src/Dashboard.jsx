// frontend/src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Dashboard() {
  const [message, setMessage] = useState("");
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

  return (
    <div className="ap-page">
      <div className="ap-card" style={{ flexDirection: "column", maxWidth: "600px", padding: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
          <img src="/logo.png" alt="ArcherPhish logo" className="ap-logo" style={{ marginRight: "16px" }} />
          <h1>Dashboard</h1>
        </div>
        <p style={{ color: "#dffcff", fontSize: "16px" }}>{message}</p>
        <button className="ap-button" onClick={handleLogout} style={{ marginTop: "20px", width: "140px" }}>
          Logout
        </button>
      </div>
    </div>
  );
}
