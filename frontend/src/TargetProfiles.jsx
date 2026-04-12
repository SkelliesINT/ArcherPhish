import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import axios from "axios";
import Sidebar from "./Sidebar";
import "./Dashboard.css";
import "./TargetProfiles.css";

const EMPTY_OSINT = { linkedin: "", social: "", location: "", manager: "", interests: "", projects: "", notes: "" };

// Defined outside component so React doesn't treat it as a new type on every render
function OsintPanel({ data, onChange }) {
  return (
    <div className="osint-panel">
      <p className="osint-panel-title">OSINT Identifiers</p>
      <div className="osint-grid">
        <div className="osint-field">
          <label className="osint-label">LinkedIn URL</label>
          <input className="osint-input" placeholder="https://linkedin.com/in/..." value={data.linkedin || ""} onChange={e => onChange("linkedin", e.target.value)} />
        </div>
        <div className="osint-field">
          <label className="osint-label">Social Media Handle</label>
          <input className="osint-input" placeholder="@handle (Twitter, Instagram...)" value={data.social || ""} onChange={e => onChange("social", e.target.value)} />
        </div>
        <div className="osint-field">
          <label className="osint-label">Location / City</label>
          <input className="osint-input" placeholder="e.g. Cincinnati, OH" value={data.location || ""} onChange={e => onChange("location", e.target.value)} />
        </div>
        <div className="osint-field">
          <label className="osint-label">Manager / Reports To</label>
          <input className="osint-input" placeholder="Direct manager's name" value={data.manager || ""} onChange={e => onChange("manager", e.target.value)} />
        </div>
        <div className="osint-field">
          <label className="osint-label">Personal Interests / Hobbies</label>
          <textarea className="osint-textarea" placeholder="e.g. cycling, travel, college football..." value={data.interests || ""} onChange={e => onChange("interests", e.target.value)} />
        </div>
        <div className="osint-field">
          <label className="osint-label">Key Projects / Role Focus</label>
          <textarea className="osint-textarea" placeholder="e.g. Q3 budget review, ERP migration..." value={data.projects || ""} onChange={e => onChange("projects", e.target.value)} />
        </div>
        <div className="osint-field osint-field-full">
          <label className="osint-label">Additional OSINT Notes</label>
          <textarea className="osint-textarea" placeholder="Any other useful context for crafting targeted emails..." value={data.notes || ""} onChange={e => onChange("notes", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function DeptSelect({ value, onChange, showNew, setShowNew, newInput, setNewInput, departments, onAddDepartment }) {
  if (showNew) {
    return (
      <div className="new-dept-inline">
        <input
          type="text"
          placeholder="Department name"
          value={newInput}
          onChange={(e) => setNewInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAddDepartment(newInput, (name) => { onChange(name); setShowNew(false); setNewInput(""); });
            } else if (e.key === "Escape") {
              setShowNew(false); setNewInput("");
            }
          }}
          autoFocus
        />
        <button
          className="dept-confirm-btn"
          onClick={() => onAddDepartment(newInput, (name) => { onChange(name); setShowNew(false); setNewInput(""); })}
        >✓</button>
        <button className="dept-cancel-btn" onClick={() => { setShowNew(false); setNewInput(""); }}>✕</button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__add_new__") {
          setShowNew(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className="dept-select"
    >
      <option value="">Select Department</option>
      {departments.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
      {value && !departments.includes(value) && (
        <option value={value}>{value}</option>
      )}
      <option value="__add_new__">＋ Add new department...</option>
    </select>
  );
}

export default function TargetProfiles() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const { user, permissions } = useAuth();
  const isLoggedIn = !!user;
  const canView = permissions.includes("view_recipients");
  const canManage = permissions.includes("manage_recipients");
  const canManageSettings = permissions.includes("modify_system_settings");

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
  const [newHighRisk, setNewHighRisk] = useState(false);
  const [newOsint, setNewOsint] = useState({ ...EMPTY_OSINT });
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Departments
  const [departments, setDepartments] = useState([]);
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState("");

  // Department filter
  const [filterDept, setFilterDept] = useState("");

  // Sort state
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [showEditNewDept, setShowEditNewDept] = useState(false);
  const [editNewDeptInput, setEditNewDeptInput] = useState("");

  // Company name setting
  const [companyName, setCompanyName] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [companySaving, setCompanySaving] = useState(false);

  const fetchCompanyName = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:4000/api/settings", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
      setCompanyName(res.data.companyName || "");
      setCompanyInput(res.data.companyName || "");
    } catch (err) {
      console.error("Failed to load company name:", err);
    }
  };

  const handleSaveCompany = async () => {
    if (!canManageSettings) return;

    setCompanySaving(true);
    try {
      const token = localStorage.getItem("token");

      await axios.put(
        "http://localhost:4000/api/settings",
        { companyName: companyInput.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      setCompanyName(companyInput.trim());
    } catch (err) {
      console.error("Failed to save company name:", err);
    } finally {
      setCompanySaving(false);
    }
  };

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:4000/api/departments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
    });
      setDepartments(res.data);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  };

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
    if (canView) fetchDepartments();
    if (canManageSettings) fetchCompanyName();
  }, [canView, canManageSettings]);

  // Add a new department to the managed list
  const handleAddDepartment = async (name, onSuccess) => {
    if (!canManage) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await axios.post(
      "http://localhost:4000/api/departments",
      { name: trimmed },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setDepartments((prev) => [...new Set([...prev, trimmed])].sort());
      onSuccess(trimmed);
    } catch (err) {
      console.error("Failed to add department:", err);
    }
  };

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
        {
          firstName: newFirstName,
          lastName: newLastName,
          email: newEmail,
          department: newDepartment,
          jobTitle: newJobTitle,
          highRisk: newHighRisk,
          osintData: newHighRisk ? newOsint : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecipients((prev) => [...prev, res.data.recipient]);
      setMessage("Recipient added!");
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewDepartment("");
      setNewJobTitle("");
      setNewHighRisk(false);
      setNewOsint({ ...EMPTY_OSINT });
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

  // Start editing a recipient
  const handleEditStart = (r) => {
    if (!canManage) return;

    setEditingId(r.id);
    setEditFields({
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      email: r.email || "",
      department: r.department || "",
      jobTitle: r.jobTitle || "",
      highRisk: !!r.highRisk,
      osintData: r.osintData ? { ...EMPTY_OSINT, ...r.osintData } : { ...EMPTY_OSINT },
    });
    setShowEditNewDept(false);
    setEditNewDeptInput("");
  };

  // Save edit
  const handleEditSave = async () => {
    if (!canManage) return;

    try {
      const res = await axios.put(
        `http://localhost:4000/api/recipients/${editingId}`,
        {
          ...editFields,
          osintData: editFields.highRisk ? editFields.osintData : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecipients((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...res.data } : r)));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save changes");
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
      fetchDepartments();
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

  // Filtered + sorted list
  const filteredRecipients = recipients
    .filter((r) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (r.firstName || "").toLowerCase().includes(term) ||
        (r.lastName || "").toLowerCase().includes(term) ||
        (r.email || "").toLowerCase().includes(term) ||
        (r.department || "").toLowerCase().includes(term) ||
        (r.jobTitle || "").toLowerCase().includes(term);
      const matchesDept = !filterDept || (r.department || "") === filterDept;
      return matchesSearch && matchesDept;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      const av = (a[sortField] || "").toLowerCase();
      const bv = (b[sortField] || "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main dashboard-main--fill">
        <h1>Target Profiles</h1>

        {permissions.includes("modify_system_settings") && (
        <div className="tp-company-bar">
          <label className="tp-company-label">Organization Name</label>
          <input
            className="tp-company-input"
            placeholder="e.g. Acme Corp"
            value={companyInput}
            onChange={e => setCompanyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveCompany()}
          />
          <button
            className="tp-company-save-btn"
            onClick={handleSaveCompany}
            disabled={companySaving || companyInput.trim() === companyName}
          >
            {companySaving ? "Saving..." : "Save"}
          </button>
          {companyName && companyInput.trim() === companyName && (
            <span className="tp-company-saved">Saved</span>
          )}
        </div>
        )}
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
            <DeptSelect
              value={newDepartment}
              onChange={setNewDepartment}
              showNew={showNewDept}
              setShowNew={setShowNewDept}
              newInput={newDeptInput}
              setNewInput={setNewDeptInput}
              departments={departments}
              onAddDepartment={canManage ? handleAddDepartment : undefined}
            />
            <input
              type="text"
              placeholder="Job Title"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
            />
            <label className="high-risk-checkbox-label">
              <input
                type="checkbox"
                checked={newHighRisk}
                onChange={(e) => setNewHighRisk(e.target.checked)}
              />
              High Risk
            </label>
            <button onClick={handleAdd}>Add</button>
          </div>

          {newHighRisk && (
            <OsintPanel
              data={newOsint}
              onChange={(field, val) => setNewOsint(o => ({ ...o, [field]: val }))}
            />
          )}

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
        {permissions.includes("view_recipients") && (
        <div className="search-container">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="dept-filter-select"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {[...new Set([
              ...departments,
              ...recipients.map(r => r.department).filter(Boolean),
            ])].sort().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        )}
        {permissions.includes("view_recipients") && (
        <div className="recipient-table-container">
          <table className="recipient-table">
            <thead>
              <tr>
                {[
                  { label: "First Name", field: "firstName" },
                  { label: "Last Name",  field: "lastName"  },
                  { label: "Email",      field: "email"     },
                  { label: "Department", field: "department"},
                  { label: "Job Title",  field: "jobTitle"  },
                ].map(({ label, field }) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="sortable-th"
                  >
                    {label}
                    <span className="sort-indicator">
                      {sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}
                    </span>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipients.map((r) =>
                editingId === r.id ? (
                  <React.Fragment key={r.id}>
                    <tr className="editing-row">
                      <td>
                        <input
                          className="edit-input"
                          value={editFields.firstName}
                          onChange={(e) => setEditFields((f) => ({ ...f, firstName: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          className="edit-input"
                          value={editFields.lastName}
                          onChange={(e) => setEditFields((f) => ({ ...f, lastName: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          className="edit-input"
                          type="email"
                          value={editFields.email}
                          onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))}
                        />
                      </td>
                      <td>
                        <DeptSelect
                          value={editFields.department}
                          onChange={(val) => setEditFields((f) => ({ ...f, department: val }))}
                          showNew={showEditNewDept}
                          setShowNew={setShowEditNewDept}
                          newInput={editNewDeptInput}
                          setNewInput={setEditNewDeptInput}
                          departments={departments}
                          onAddDepartment={canManage ? handleAddDepartment : undefined}
                        />
                      </td>
                      <td>
                        <input
                          className="edit-input"
                          value={editFields.jobTitle}
                          onChange={(e) => setEditFields((f) => ({ ...f, jobTitle: e.target.value }))}
                        />
                      </td>
                      <td className="edit-actions">
                        <label className="high-risk-checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!editFields.highRisk}
                            onChange={(e) => setEditFields((f) => ({ ...f, highRisk: e.target.checked }))}
                          />
                          High Risk
                        </label>
                        <button className="save-btn" onClick={handleEditSave}>Save</button>
                        <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                      </td>
                    </tr>
                    {editFields.highRisk && (
                      <tr className="osint-edit-row">
                        <td colSpan={6}>
                          <OsintPanel
                            data={editFields.osintData || EMPTY_OSINT}
                            onChange={(field, val) => setEditFields(f => ({ ...f, osintData: { ...f.osintData, [field]: val } }))}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ) : (
                  <tr key={r.id} className={r.highRisk ? "high-risk-row" : ""}>
                    <td>
                      {r.firstName}
                      {r.highRisk ? <span className="high-risk-badge">HIGH RISK</span> : null}
                    </td>
                    <td>{r.lastName}</td>
                    <td>{r.email}</td>
                    <td>{r.department || "—"}</td>
                    <td>{r.jobTitle || "—"}</td>
                    {permissions.includes("manage_recipients") && (
                    <td className="edit-actions">
                      <button className="edit-btn" onClick={() => handleEditStart(r)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDelete(r.id)}>Delete</button>
                    </td>
                    )}
                  </tr>
                )
              )}
              {filteredRecipients.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    No recipients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
