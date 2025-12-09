import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // reuse existing styles

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

export default function CreateCampaign() {
  const [prompt, setPrompt] = useState("");
  const [role, setRole] = useState("generic");
  const [difficulty, setDifficulty] = useState("medium");
  const [showModal, setShowModal] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState(""); // new
  const [loading, setLoading] = useState(false);
  const [existingLinks, setExistingLinks] = useState([]);
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:4000/api/links")
      .then(res => res.json())
      .then(data => {
        const linksArray = Object.values(data);
        setExistingLinks(linksArray);
        if (linksArray.length > 0) setSelectedLinkId(linksArray[0].id);
      })
      .catch(err => console.error("Failed to fetch links:", err));
  }, []);

  const handleCancel = () => {
    navigate("/dashboard"); // go back to dashboard
  };

  const handleRoleChange = (newRole) => {
     setRole(newRole);

    // Remove any existing role template from the prompt
    let cleanedPrompt = prompt || "";
    Object.values(ROLE_TEMPLATES).forEach(template => {
      if (cleanedPrompt.startsWith(template)) {
        cleanedPrompt = cleanedPrompt.slice(template.length).trimStart();
      }
    });

    setPrompt(`${ROLE_TEMPLATES[newRole]}\n\n${cleanedPrompt}`);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Prompt cannot be empty");

    setLoading(true);
    setGeneratedEmail("");

    try {
      const response = await fetch("http://localhost:4000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          role,
          difficulty,
          model: "gpt-3.5-turbo"
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate email");
      }

      setGeneratedEmail(data.simulatedEmail || "No email generated.");
      setShowModal(true);
    } catch (err) {
      console.error(err);
      alert("Error generating email. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!generatedEmail) return alert("No generated email to send");

    if (!selectedLinkId) return alert("Please select a tracking link before sending.");

    const testOnly = window.confirm("Send test to a single recipient only? (OK = test, Cancel = send to all)");

    try {
      const res = await fetch("http://localhost:4000/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedEmail: generatedEmail,
          testOnly,
          linkId: selectedLinkId // 👈 use the existing link
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send campaign');

      alert(data.message + (data.details ? ` (${data.details.success}/${data.details.total})` : ''));
      setShowModal(false);
      setGeneratedEmail('');
      setPrompt('');
    } catch (err) {
      console.error(err);
      alert("Error sending campaign: " + err.message);
    }
  };

  const handleModalCancel = () => {
    setShowModal(false);
  };

  return (
      <div className="ap-page" style={{ position: "relative" }}>
      <div className={showModal ? "blur-background" : ""}>
        <div className="ap-card" style={{ flexDirection: "column", maxWidth: "700px", padding: "28px" }}>
          <h1>Create Campaign (Phishing Awareness Simulator)</h1>

          <label style={{ marginTop: 12 }}>Role (simulation style)</label>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="ap-input"
            style={{ width: "100%", marginTop: 8, background: "#151518ff",padding: 10 }}
          >
            <option value="generic">Generic scam </option>
            <option value="invoice_spoof">Invoice / billing spoof </option>
            <option value="spear_phish">Spear-phishing style </option>
            <option value="account_alert">Account alert / password reset style</option>
          </select>

          <label style={{ marginTop: 12 }}>Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="ap-input"
            style={{ width: "100%", marginTop: 8,background: "#151518ff",padding: 10 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <label style={{ marginTop: 12 }}>Select Tracking Link</label>
          <select
            value={selectedLinkId || ""}
            onChange={(e) => setSelectedLinkId(e.target.value)}
            className="ap-input"
            style={{ width: "100%", marginTop: 8, padding: 10 }}
          >
            {existingLinks.length === 0 && <option value="">No links available</option>}
            {existingLinks.map(link => (
              <option key={link.id} value={link.id}>
                {link.name || link.url}
              </option>
            ))}
          </select>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a short scenario or modify the template (for educational use only)"
            className="ap-input"
            style={{ minHeight: "150px", marginTop: "16px", resize: "vertical" }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", gap: "12px" }}>
            <button type="button" className="ap-button" style={{ background: "#555", padding: "10px 14px" }} onClick={handleCancel}>
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
        </div>
      </div>

      {showModal && (
        <div className="ap-modal-overlay">
          <div className="ap-card ap-modal-card" style={{ maxWidth: "800px" }}>
            <h2>Generated Email (SIMULATION)</h2>
            <div style={{ background: "#151518ff", padding: 16, borderRadius: 8, minHeight: 120, whiteSpace: "pre-wrap", marginBottom: 12 }}>
              {generatedEmail}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ap-button" style={{ background: "#555" }} onClick={handleModalCancel}>Close</button>
              <button className="ap-button" onClick={handleApprove}>Approve Campaign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}