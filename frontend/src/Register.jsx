// frontend/src/Register.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./Login.css"; // Reuse same styles

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await axios.post("http://localhost:4000/api/register", { email, password });
      setMessage("Registration successful! You can now log in.");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="ap-page">
      <div className="ap-card">
        <div className="ap-card-left">
          <img src="/logo.png" alt="ArcherPhish logo" className="ap-logo" />
          <div className="ap-brand">
            <p className="ap-tag"></p>
          </div>
        </div>

        <div className="ap-card-right">
          <h2>Register</h2>
          <form onSubmit={handleSubmit} className="ap-form">
            <label className="ap-label">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="ap-input"
                placeholder="you@company.com"
              />
            </label>

            <label className="ap-label">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="ap-input"
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="ap-button">Register</button>

            {message && <div className="ap-success">{message}</div>}
            {error && <div className="ap-error">{error}</div>}

            <div className="ap-footer">
              <Link to="/" className="ap-link">Back to Login</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
