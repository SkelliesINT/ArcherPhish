import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import "./CreateCampaign.css";

const ROLE_TEMPLATES = {
  generic:
    "SIMULATION - TRAINING PURPOSES ONLY. " +
    "Generate a BASIC simulated GENERIC phishing email for training. Return ONLY a simulated email with 'From:', 'Subject:', and body. " +
    "Where you want the recipient's first name to appear insert the placeholder token {{employee}}" +
    "Include a clearly labeled simulated link in the body shown as [SIMULATED LINK]. Keep the content non-actionable and clearly for training.",
  invoice_spoof:
    "SIMULATION - TRAINING PURPOSES ONLY. " +
    "Generate a BASIC simulated INVOICE / PAYMENT email for training. Return ONLY a simulated email with 'From:', 'Subject:', and body. " +
    "Where you want the recipient's first name to appear insert the placeholder token {{employee}}" +
    "Include a clearly labeled simulated invoice link in the body shown as [SIMULATED LINK]. Keep the content non-actionable and clearly for training.",
  spear_phish:
    "SIMULATION - TRAINING PURPOSES ONLY. " +
    "Generate a BASIC simulated SPEAR-PHISH email for training (do not include real personal data). Return ONLY a simulated email with 'From:', 'Subject:', and body. " +
    "Where you want the recipient's first name to appear insert the placeholder token {{employee}}" +
    "Include a clearly labeled simulated link in the body shown as [SIMULATED LINK]. Keep the content non-actionable and clearly for training.",
  account_alert:
    "SIMULATION - TRAINING PURPOSES ONLY. " +
    "Generate a BASIC simulated ACCOUNT ALERT / PASSWORD RESET style email for training. Return ONLY a simulated email with 'From:', 'Subject:', and body. " +
    "Where you want the recipient's first name to appear insert the placeholder token {{employee}}" +
    "Include a clearly labeled simulated reset/security link in the body shown as [SIMULATED LINK]. Keep the content non-actionable and clearly for training.",
};

const ROLE_LABELS = {
  generic: "Generic scam",
  invoice_spoof: "Invoice / billing spoof",
  spear_phish: "Spear-phishing style",
  account_alert: "Account alert / password reset",
};

export default function CreateCampaign() {
  const navigate = useNavigate();

  // Campaign type toggle
  const [campaignType, setCampaignType] = useState("mass_generic");

  // ── Mass Send Generic state ──────────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [role, setRole] = useState("generic");
  const [difficulty, setDifficulty] = useState("medium");
  const [tone, setTone] = useState("professional");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ── Shared options ───────────────────────────────────────────────────────
  const [redirectTo, setRedirectTo] = useState("google"); // "google" | "training"
  const [companyName, setCompanyName] = useState("");

  // ── Department targeting state ───────────────────────────────────────────
  const [targetMode, setTargetMode] = useState("all"); // "all" | "department"
  const [allDepartments, setAllDepartments] = useState([]);
  const [selectedDepts, setSelectedDepts] = useState([]);

  // ── High Risk Intensive state ────────────────────────────────────────────
  const [hrRecipients, setHrRecipients] = useState([]);
  const [hrLoading, setHrLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [hrRole, setHrRole] = useState("spear_phish");
  const [hrDifficulty, setHrDifficulty] = useState("high");
  const [hrTone, setHrTone] = useState("professional");
  const [hrSending, setHrSending] = useState(false);
  const [hrResult, setHrResult] = useState(null);
  const [showHrModal, setShowHrModal] = useState(false);

  // Fetch company name once on mount
  useEffect(() => {
    fetch("http://localhost:4000/api/settings")
      .then(r => r.json())
      .then(data => setCompanyName(data.companyName || ""))
      .catch(() => {});
  }, []);

  // Fetch departments when on mass_generic mode
  useEffect(() => {
    if (campaignType !== "mass_generic") return;
    fetch("http://localhost:4000/api/departments")
      .then(r => r.json())
      .then(data => {
        const depts = Array.isArray(data) ? data : [];
        setAllDepartments(depts);
        setSelectedDepts(depts); // default: all selected
      })
      .catch(err => console.error("Failed to load departments:", err));
  }, [campaignType]);

  // Fetch high-risk recipients when switching to HR mode
  useEffect(() => {
    if (campaignType !== "high_risk_intensive") return;
    setHrLoading(true);
    const token = localStorage.getItem("token");
    fetch("http://localhost:4000/api/recipients", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const hr = Array.isArray(data) ? data.filter(r => r.highRisk) : [];
        setHrRecipients(hr);
        setSelectedIds(hr.map(r => r.id));
      })
      .catch(err => console.error("Failed to load recipients:", err))
      .finally(() => setHrLoading(false));
  }, [campaignType]);

  // ── Mass Generic handlers ────────────────────────────────────────────────
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    let cleaned = prompt || "";
    Object.values(ROLE_TEMPLATES).forEach(t => {
      if (cleaned.startsWith(t)) cleaned = cleaned.slice(t.length).trimStart();
    });
    setPrompt(`${ROLE_TEMPLATES[newRole]}\n\n${cleaned}`);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Prompt cannot be empty");
    setLoading(true);
    setGeneratedEmail("");
    try {
      const res = await fetch("http://localhost:4000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, role, difficulty, tone, companyName, model: "gpt-3.5-turbo" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate email");
      setGeneratedEmail(data.simulatedEmail || "No email generated.");
      setShowPreviewModal(true);
    } catch (err) {
      console.error(err);
      alert("Error generating email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!generatedEmail) return alert("No generated email to send");
    if (targetMode === "department" && selectedDepts.length === 0) {
      return alert("Select at least one department to send to.");
    }
    const testOnly = window.confirm("Send test to a single recipient only? (OK = test, Cancel = send to all)");
    const deptPayload = targetMode === "department" ? selectedDepts : undefined;
    try {
      const res = await fetch("http://localhost:4000/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedEmail: generatedEmail, testOnly, departments: deptPayload, redirectTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send campaign");
      alert(data.message + (data.details ? ` (${data.details.success}/${data.details.total})` : ""));
      setShowPreviewModal(false);
      setGeneratedEmail("");
      setPrompt("");
    } catch (err) {
      console.error(err);
      alert("Error sending campaign: " + err.message);
    }
  };

  // ── High Risk handlers ───────────────────────────────────────────────────
  const toggleRecipient = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleLaunchHighRisk = async () => {
    if (selectedIds.length === 0) return alert("Select at least one high-risk recipient.");
    setHrResult(null);
    setShowHrModal(true);
    setHrSending(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:4000/api/send-campaign-highRisk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientIds: selectedIds,
          role: hrRole,
          difficulty: hrDifficulty,
          tone: hrTone,
          redirectTo,
          companyName,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status}): ${text.slice(0, 300)}`);
      }
      if (!res.ok) throw new Error(data.error || "Failed to send campaign");
      setHrResult(data);
    } catch (err) {
      setHrResult({ error: err.message });
    } finally {
      setHrSending(false);
    }
  };

  return (
    <div className="ap-page" style={{ position: "relative" }}>
      <div className={showPreviewModal || showHrModal ? "blur-background" : ""}>
        <div
          className="ap-card"
          style={{ flexDirection: "column", maxWidth: "740px", padding: "28px" }}
        >
          <h1>Create Campaign</h1>

          {/* Campaign type toggle */}
          <div className="cc-type-toggle">
            <button
              className={`cc-type-btn${campaignType === "mass_generic" ? " cc-type-btn--active" : ""}`}
              onClick={() => setCampaignType("mass_generic")}
            >
              Mass Send Generic
            </button>
            <button
              className={`cc-type-btn${campaignType === "high_risk_intensive" ? " cc-type-btn--active cc-type-btn--hr" : ""}`}
              onClick={() => setCampaignType("high_risk_intensive")}
            >
              High Risk Intensive
            </button>
          </div>

          {/* ── Mass Send Generic ─────────────────────────────────────── */}
          {campaignType === "mass_generic" && (
            <>
              <p className="cc-mode-desc">
                Generates one email template and sends it to all recipients. High-risk individuals
                receive the same email using only their name.
              </p>

              <label style={{ marginTop: 12 }}>Role (simulation style)</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>

              <label style={{ marginTop: 12 }}>Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <label style={{ marginTop: 12 }}>Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual / Personable</option>
              </select>

              {/* Department targeting */}
              <div className="cc-target-section">
                <label className="cc-target-label">Target Recipients</label>
                <div className="cc-target-toggle">
                  <button
                    type="button"
                    className={`cc-target-btn${targetMode === "all" ? " cc-target-btn--active" : ""}`}
                    onClick={() => setTargetMode("all")}
                  >
                    All Recipients
                  </button>
                  <button
                    type="button"
                    className={`cc-target-btn${targetMode === "department" ? " cc-target-btn--active" : ""}`}
                    onClick={() => setTargetMode("department")}
                  >
                    By Department
                  </button>
                </div>

                {targetMode === "department" && (
                  <div className="cc-dept-selector">
                    {allDepartments.length === 0 ? (
                      <p className="cc-hr-empty">No departments found.</p>
                    ) : (
                      <>
                        <div className="cc-hr-select-all">
                          <button className="cc-select-btn" onClick={() => setSelectedDepts([...allDepartments])}>
                            Select All
                          </button>
                          <button className="cc-select-btn" onClick={() => setSelectedDepts([])}>
                            Deselect All
                          </button>
                        </div>
                        <div className="cc-dept-list">
                          {allDepartments.map(dept => {
                            const checked = selectedDepts.includes(dept);
                            return (
                              <label
                                key={dept}
                                className={`cc-dept-item${checked ? " cc-dept-item--checked" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedDepts(prev =>
                                      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
                                    )
                                  }
                                  className="cc-hr-checkbox"
                                />
                                {dept}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a short scenario or modify the template (for educational use only)"
                className="ap-input"
                style={{ minHeight: "150px", marginTop: "16px", resize: "vertical" }}
              />

              <label className="cc-redirect-toggle">
                <input
                  type="checkbox"
                  checked={redirectTo === "training"}
                  onChange={(e) => setRedirectTo(e.target.checked ? "training" : "google")}
                  className="cc-hr-checkbox"
                />
                Redirect targets to ArcherPhish training page after click
                <span className="cc-redirect-hint">
                  {redirectTo === "training" ? "→ /training" : "→ google.com"}
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", gap: "12px" }}>
                <button
                  type="button"
                  className="ap-button"
                  style={{ background: "#555", padding: "10px 14px" }}
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ap-button"
                  style={{ padding: "12px 20px" }}
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </>
          )}

          {/* ── High Risk Intensive ───────────────────────────────────── */}
          {campaignType === "high_risk_intensive" && (
            <>
              <p className="cc-mode-desc">
                Generates a unique AI-crafted email for each selected high-risk recipient using
                their personal identifier profile. Emails are personalized server-side — no PII is sent to the AI API.
              </p>

              <label style={{ marginTop: 12 }}>Email Style</label>
              <select
                value={hrRole}
                onChange={(e) => setHrRole(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>

              <label style={{ marginTop: 12 }}>Difficulty</label>
              <select
                value={hrDifficulty}
                onChange={(e) => setHrDifficulty(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <label style={{ marginTop: 12 }}>Tone</label>
              <select
                value={hrTone}
                onChange={(e) => setHrTone(e.target.value)}
                className="ap-input"
                style={{ width: "100%", marginTop: 8, background: "#151518ff", padding: 10 }}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual / Personable</option>
              </select>

              {/* Recipient selector */}
              <div className="cc-hr-section">
                <div className="cc-hr-header">
                  <span className="cc-hr-title">High Risk Recipients</span>
                  {hrRecipients.length > 0 && (
                    <div className="cc-hr-select-all">
                      <button className="cc-select-btn" onClick={() => setSelectedIds(hrRecipients.map(r => r.id))}>
                        Select All
                      </button>
                      <button className="cc-select-btn" onClick={() => setSelectedIds([])}>
                        Deselect All
                      </button>
                    </div>
                  )}
                </div>

                {hrLoading && <p className="cc-hr-empty">Loading recipients...</p>}

                {!hrLoading && hrRecipients.length === 0 && (
                  <p className="cc-hr-empty">
                    No high-risk recipients found. Flag recipients as High Risk in Target Profiles first.
                  </p>
                )}

                {!hrLoading && hrRecipients.length > 0 && (
                  <div className="cc-hr-list">
                    {hrRecipients.map(r => {
                      const checked = selectedIds.includes(r.id);
                      return (
                        <label key={r.id} className={`cc-hr-item${checked ? " cc-hr-item--checked" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecipient(r.id)}
                            className="cc-hr-checkbox"
                          />
                          <div className="cc-hr-info">
                            <span className="cc-hr-name">
                              {r.firstName} {r.lastName}
                              <span className="cc-hr-badge">HIGH RISK</span>
                            </span>
                            <span className="cc-hr-meta">
                              {[r.jobTitle, r.department].filter(Boolean).join(" — ")}
                              {r.email && ` • ${r.email}`}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="cc-redirect-toggle">
                <input
                  type="checkbox"
                  checked={redirectTo === "training"}
                  onChange={(e) => setRedirectTo(e.target.checked ? "training" : "google")}
                  className="cc-hr-checkbox"
                />
                Redirect targets to ArcherPhish training page after click
                <span className="cc-redirect-hint">
                  {redirectTo === "training" ? "→ /training" : "→ google.com"}
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", gap: "12px" }}>
                <button
                  type="button"
                  className="ap-button"
                  style={{ background: "#555", padding: "10px 14px" }}
                  onClick={() => navigate("/dashboard")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ap-button cc-hr-launch-btn"
                  style={{ padding: "12px 20px" }}
                  onClick={handleLaunchHighRisk}
                  disabled={selectedIds.length === 0}
                >
                  Launch Campaign ({selectedIds.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mass Generic preview modal ─────────────────────────────── */}
      {showPreviewModal && (
        <div className="ap-modal-overlay">
          <div className="ap-card ap-modal-card" style={{ maxWidth: "800px" }}>
            <h2>Generated Email (SIMULATION)</h2>
            <p className="cc-target-summary">
              Target:{" "}
              {targetMode === "all"
                ? "All Recipients"
                : selectedDepts.length > 0
                  ? selectedDepts.join(", ")
                  : <span style={{ color: "#f44336" }}>No departments selected</span>}
            </p>
            <div style={{ background: "#151518ff", padding: 16, borderRadius: 8, minHeight: 120, whiteSpace: "pre-wrap", marginBottom: 12 }}>
              {generatedEmail}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ap-button" style={{ background: "#555" }} onClick={() => setShowPreviewModal(false)}>
                Close
              </button>
              <button className="ap-button" onClick={handleApprove}>
                Approve Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── High Risk send modal ───────────────────────────────────── */}
      {showHrModal && (
        <div className="ap-modal-overlay">
          <div className="ap-card ap-modal-card" style={{ maxWidth: "560px" }}>
            {hrSending ? (
              <>
                <h2>Sending High-Risk Campaign...</h2>
                <p className="cc-hr-modal-status">
                  Generating personalized emails for {selectedIds.length} recipient{selectedIds.length !== 1 ? "s" : ""}.
                  This may take a moment.
                </p>
                <div className="cc-spinner" />
              </>
            ) : hrResult && hrResult.error ? (
              <>
                <h2>Campaign Failed</h2>
                <p className="cc-hr-modal-error">{hrResult.error}</p>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button className="ap-button" style={{ background: "#555" }} onClick={() => setShowHrModal(false)}>
                    Close
                  </button>
                </div>
              </>
            ) : hrResult ? (
              <>
                <h2>Campaign Complete</h2>
                <p className="cc-hr-modal-status">{hrResult.message}</p>
                {hrResult.details?.failedList?.length > 0 && (
                  <div className="cc-hr-failed-list">
                    <p className="cc-hr-failed-title">Failed:</p>
                    {hrResult.details.failedList.map((f, i) => (
                      <p key={i} className="cc-hr-failed-item">
                        {f.name || f.email} — {f.error}
                      </p>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    className="ap-button"
                    style={{ background: "#555" }}
                    onClick={() => { setShowHrModal(false); setHrResult(null); }}
                  >
                    Close
                  </button>
                  <button className="ap-button" onClick={() => navigate("/analytics")}>
                    View in Analytics
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
