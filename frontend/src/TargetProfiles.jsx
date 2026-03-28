import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./Dashboard.css";
import "./TargetProfiles.css";

export default function TargetProfiles() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const isLoggedIn = !!user;
  const canView = permissions.includes("view_recipients");
  const canManage = permissions.includes("manage_recipients");

  useEffect(() => {
    if (!isLoggedIn || !canView) {
      navigate("/dashboard");
    }
  }, [isLoggedIn, canView, navigate]);

  const [recipients, setRecipients] = useState([]);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch recipients
  const fetchRecipients = async () => {
    try {
      const token = localStorage.getItem("token");
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
    if (canView) fetchRecipients();
  }, [canView]);

  // Add recipient
  const handleAdd = async () => {
    setMessage("");
    setError("");
    if (!newEmail) return setError("Email required");
    if (!canManage) return setError("You do not have permission to add recipients");

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:4000/api/recipients",
        { firstName: newFirstName, lastName: newLastName, email: newEmail, department: newDepartment, jobTitle: newJobTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecipients((prev) => [...prev, res.data.recipient]);
      setMessage("Recipient added!");
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewDepartment("");
      setNewJobTitle("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add recipient");
    }
  };

  // Delete recipient
  const handleDelete = async (id) => {
    if (!canManage) return setError("You do not have permission to delete recipients");

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:4000/api/recipients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError("Failed to delete recipient");
    }
  };

  // CSV import
  const handleCSVUpload = async () => {
    if (!csvFile) return setError("Please select a CSV file");
    setUploading(true);
    setMessage("");
    setError("");
    const formData = new FormData();
    formData.append("file", csvFile);
    try {
      const res = await axios.post("http://localhost:4000/api/recipients/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(`✅ ${res.data.message}`);
      setCsvFile(null);
      fetchRecipients();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to import CSV");
    } finally {
      setUploading(false);
    }
  };

  // CSV export
  const handleCSVExport = () => {
    window.location.href = "http://localhost:4000/api/recipients/export";
  };

  // Filtered list
  const filteredRecipients = recipients.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      (r.firstName || "").toLowerCase().includes(term) ||
      (r.lastName || "").toLowerCase().includes(term) ||
      (r.email || "").toLowerCase().includes(term) ||
      (r.department || "").toLowerCase().includes(term) ||
      (r.jobTitle || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <h1>Target Profiles</h1>

        {canManage && (
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
            <input
              type="text"
              placeholder="Department"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
            />
            <input
              type="text"
              placeholder="Job Title"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
            />
            <button onClick={handleAdd}>Add</button>
          </div>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
        )}

        {canManage && (
        <div className="csv-container">
          <div className="csv-section">
            <h3 className="csv-title">Import Recipients</h3>
            <p className="csv-description">Upload a CSV with columns: firstName, lastName, email, department, jobTitle</p>
            <div className="csv-upload">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
              <button onClick={handleCSVUpload} disabled={uploading} className="upload-btn">
                {uploading ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
          </div>

          {permissions.includes("export_reports") && ( 
          <>
          <div className="csv-divider" />
          <div className="csv-section">
            <h3 className="csv-title">Export Campaign Results</h3>
            <p className="csv-description">Download all recipients with campaign engagement metrics as a CSV.</p>
            <button className="export-btn" onClick={handleCSVExport}>Download Results</button>
          </div>
          </>
          )}
        </div>
        )}

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
                <th>Department</th>
                <th>Job Title</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((r) => (
                <tr key={r.id}>
                  <td>{r.firstName}</td>
                  <td>{r.lastName}</td>
                  <td>{r.email}</td>
                  <td>{r.department || "—"}</td>
                  <td>{r.jobTitle || "—"}</td>
                  <td>
                    {permissions.includes("manage_recipients") && (
                    <button className="delete-btn" onClick={() => handleDelete(r.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecipients.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} style={{ textAlign: "center" }}>
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
