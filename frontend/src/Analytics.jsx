import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCrosshairs, FaChartLine, FaSignOutAlt, FaHome, FaNewspaper } from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import "./Dashboard.css";
import "./index.css";
import "./Analytics.css";

export default function Analytics() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // placeholder
  const placeholderData = [
    { name: "Jan", Failures: 30 },
    { name: "Feb", Failures: 45 },
    { name: "Mar", Failures: 60 },
    { name: "Apr", Failures: 50 },
    { name: "May", Failures: 70 },
  ];

  // Sample campaigns data for table
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: "Feb Campaign [Invoice Scam]",
      emailsSent: 100,
      opens: 75,
      clicks: 40,
      submissions: 5,
      details: [
        { recipient: "alice@example.com", opened: true, clicked: true, submitted: false },
        { recipient: "bob@example.com", opened: true, clicked: false, submitted: false },
      ],
    },
    {
      id: 2,
      name: "December Campaign [Generic]",
      emailsSent: 120,
      opens: 90,
      clicks: 55,
      submissions: 8,
      details: [
        { recipient: "carol@example.com", opened: true, clicked: true, submitted: true },
      ],
    },
  ]);

  const [expandedRows, setExpandedRows] = useState([]);

  const toggleRow = (id) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo2.png" alt="Logo part 1" className="logo-part1" />
          <img src="/logo3.png" alt="Logo part 2" className="logo-part2" />
        </div>

        <div className="sidebar-icons">
          <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
            <FaHome className="icon" />
            <span className="label">Dashboard</span>
          </div>

          <div className="sidebar-item" onClick={() => navigate("/target-profiles")}>
            <FaCrosshairs className="icon" />
            <span className="label">Target Profiles</span>
          </div>

          <div className="sidebar-item">
            <FaChartLine className="icon" />
            <span className="label">Analytics</span>
          </div>

          <div className="sidebar-item" onClick={() => navigate("/news")}>
            <FaNewspaper className="icon" />
            <span className="label">News</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item" onClick={handleLogout}>
            <FaSignOutAlt className="icon" />
            <span className="label">Logout</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="dashboard-main">
        <h1>Analytics</h1>
        <p>Review Campaigns and Phishing Awareness Progress</p>

        {/* Graph area */}
        <div className="topGraph" style={{ width: "100%", height: 300, marginTop: "30px", marginBottom: "40px" }}>
          <ResponsiveContainer>
            <LineChart
              data={placeholderData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="1 1" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                wrapperStyle={{ backgroundColor: "#222", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#fff" }}
              />
              <Legend />
              <Line type="monotone" dataKey="Failures" stroke="#00e5ff" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign table */}
        <div style={{ marginTop: "40px" }}>
          <h2>Past Campaigns</h2>
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Emails Sent</th>
                <th>Opens</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(campaign => (
                <React.Fragment key={campaign.id}>
                  <tr
                    onClick={() => toggleRow(campaign.id)}
                    style={{ cursor: "pointer", backgroundColor: expandedRows.includes(campaign.id) ? "#f0f0f0" : "transparent" }}
                  >
                    <td>{campaign.name}</td>
                    <td>{campaign.emailsSent}</td>
                    <td>{campaign.opens}</td>
                    <td>{campaign.clicks}</td>
                  </tr>
                  {expandedRows.includes(campaign.id) && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ padding: "10px 20px", backgroundColor: "#fafafa", border: "1px solid #ddd" }}>
                          <strong>Details:</strong>
                          <ul>
                            {campaign.details.map((d, i) => (
                              <li key={i}>
                                {d.recipient} — Opened: {d.opened ? "Yes" : "No"}, Clicked: {d.clicked ? "Yes" : "No"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
