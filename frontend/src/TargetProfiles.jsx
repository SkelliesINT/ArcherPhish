import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./Dashboard.css";
import "./TargetProfiles.css";

export default function TargetProfiles() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [navigate]);
  
  const [recipients, setRecipients] = useState([]);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  

  // Fetch recipients
  const fetchRecipients = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/recipients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecipients(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load recipients");
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  // Add recipient
  const handleAdd = async () => {
    setMessage("");
    setError("");
    if (!newEmail) return setError("Email required");

    try {
      const res = await axios.post(
        "http://localhost:4000/api/recipients",
        { firstName: newFirstName, lastName: newLastName, email: newEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecipients((prev) => [...prev, res.data.recipient]);
      setMessage("Recipient added!");
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add recipient");
    }
  };

  // Delete recipient
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:4000/api/recipients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError("Failed to delete recipient");
    }
  };

  // Filtered list
  const filteredRecipients = recipients.filter(
    (r) =>
      r.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <h1>Target Profiles</h1>

        <div className="add-recipient-container">
          <div className="add-recipient-inputs">
            <input
              type="text"
              placeholder="First Name"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <button onClick={handleAdd}>Add</button>
          </div>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="recipient-table-container">
          <table className="recipient-table">
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((r) => (
                <tr key={r.id}>
                  <td>{r.firstName}</td>
                  <td>{r.lastName}</td>
                  <td>{r.email}</td>
                  <td>
                    <button className="delete-btn" onClick={() => handleDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filteredRecipients.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    No recipients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
