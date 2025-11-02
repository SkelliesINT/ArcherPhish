// frontend/src/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:4000/api/login", { email, password }, {
        headers: { "Content-Type": "application/json" }
      });

      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed — try again");
    }
  };

  return (
    <div className="ap-page">
      <div className="ap-card">
        <div className="ap-card-left">
          <img src="logo.png" alt="ArcherPhish logo" className="ap-logo" />
          <div className="ap-brand">
            <p className="ap-tag"></p>
          </div>
        </div>

        <div className="ap-card-right">
          <h2>Sign in</h2>
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

            <button type="submit" className="ap-button">Sign in</button>

            {error && <div className="ap-error">{error}</div>}

            <div className="ap-footer">
              <Link to="/register" className="ap-link">Create account</Link>
              <span className="ap-dot">•</span>
              <a href="#" className="ap-link">Forgot password?</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
