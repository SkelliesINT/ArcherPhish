import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // reuse existing styles

export default function CreateCampaign() {
  const [prompt, setPrompt] = useState("");
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate("/dashboard"); // go back to dashboard
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return alert("Prompt cannot be empty");

    // Placeholder: send prompt to backend or AI service
    console.log("Generate campaign with prompt:", prompt);
 
    setShowModal(true); 
  };

  const handleApprove = () => {
    alert("Campaign approved! (placeholder)");
    setShowModal(false);
    setPrompt(""); // optionally clear prompt
  };

  const handleModalCancel = () => {
    setShowModal(false);
  };

  return (
     <div className="ap-page" style={{ position: "relative" }}>
      <div className={showModal ? "blur-background" : ""}>
        <div className="ap-card" style={{ flexDirection: "column", maxWidth: "600px", padding: "32px" }}>
          <h1>Create Campaign</h1>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter prompt"
            className="ap-input"
            style={{ minHeight: "150px", marginTop: "20px", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", gap: "12px" }}>
            <button
              type="button"
              className="ap-button"
              style={{ background: "#555", padding: "10px 14px", fontSize: "14px" }}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ap-button"
              style={{ padding: "12px 20px", fontSize: "16px" }}
              onClick={handleGenerate}
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="ap-modal-overlay">
          <div className="ap-card ap-modal-card">
            <h2>Generated Email (placeholder)</h2>
            <div className="ap-modal-buttons">
              <button
                className="ap-button"
                onClick={handleModalCancel}
                style={{ background: "#555" }}
              >
                Cancel
              </button>
              <button className="ap-button" onClick={handleApprove}>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}