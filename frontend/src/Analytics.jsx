import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import "./Dashboard.css";
import "./index.css";
import "./Analytics.css";

function parseUA(ua) {
  if (!ua) return "—";
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} / ${os}`;
}

function getBarColor(rate) {
  if (rate <= 20) return "#4caf50";
  if (rate <= 40) return "#ff9800";
  return "#f44336";
}

export default function Analytics() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [navigate]);

  const [campaigns, setCampaigns] = useState([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [recipientsCache, setRecipientsCache] = useState({});
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [atRisk, setAtRisk] = useState([]);
  const [deptRisk, setDeptRisk] = useState([]);

  const fetchCampaigns = () => {
    fetch("http://localhost:4000/api/campaigns")
      .then(res => res.json())
      .then(data => {
        console.log("[Analytics] campaigns from API:", data.map(c => ({ name: c.name, emails_sent: c.emails_sent, total_clicks: c.total_clicks })));
        setCampaigns(data);
      })
      .catch(err => console.error("Failed to load campaigns:", err));
  };

  useEffect(() => { fetchCampaigns(); }, []);

  useEffect(() => {
    fetch("http://localhost:4000/api/analytics/at-risk")
      .then(res => res.json())
      .then(data => setAtRisk(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to load at-risk:", err));
  }, []);

  useEffect(() => {
    fetch("http://localhost:4000/api/analytics/department-risk")
      .then(res => res.json())
      .then(data => setDeptRisk(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to load dept risk:", err));
  }, []);

  const handleRowClick = async (campaignId) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }
    setExpandedCampaignId(campaignId);
    if (recipientsCache[campaignId]) return;
    setLoadingRecipients(true);
    try {
      const res = await fetch(`http://localhost:4000/api/campaigns/${campaignId}/recipients`);
      const data = await res.json();
      setRecipientsCache(prev => ({ ...prev, [campaignId]: data }));
    } catch (err) {
      console.error("Failed to load campaign recipients:", err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  // Build chart data: click rate % per campaign (most recent 6, chronological)
  const chartData = [...campaigns].reverse().slice(-6).map(c => ({
    name: c.name.length > 20 ? c.name.slice(0, 20) + "…" : c.name,
    ClickRate: Number(c.emails_sent) > 0
      ? Math.round((Number(c.total_clicks) / Number(c.emails_sent)) * 100)
      : 0,
    clicks: Number(c.total_clicks) || 0,
    sent: Number(c.emails_sent) || 0,
  }));

  // Trend indicator: compare click rate of most recent vs 3rd most recent campaign
  const trendInfo = (() => {
    if (campaigns.length < 2) return null;
    const recent = campaigns.slice(0, Math.min(3, campaigns.length));
    const rateOf = c => Number(c.emails_sent) > 0
      ? (Number(c.total_clicks) / Number(c.emails_sent)) * 100
      : 0;
    const newestRate = rateOf(recent[0]);
    const oldestRate = rateOf(recent[recent.length - 1]);
    const diff = newestRate - oldestRate;
    if (Math.abs(diff) < 1) return { label: "Stable", arrow: "→", color: "#aaa", diff: 0 };
    if (diff < 0) return { label: "Improving", arrow: "↓", color: "#4caf50", diff: Math.abs(diff).toFixed(1) };
    return { label: "Worsening", arrow: "↑", color: "#f44336", diff: diff.toFixed(1) };
  })();

  return (
    <div className="dashboard-container">
      <Sidebar />

      {/* Main content */}
      <div className="dashboard-main">
        <h1>Analytics</h1>
        <p>Review Campaigns and Phishing Awareness Progress</p>

        {/* Sticky charts section */}
        <div className="analytics-sticky-charts">

        {/* Trend Indicator */}
        {trendInfo && (
          <div className="trend-bar">
            <span className="trend-label">Click Rate Trend</span>
            <span className="trend-value" style={{ color: trendInfo.color }}>
              {trendInfo.arrow} {trendInfo.label}
              {trendInfo.diff > 0 && <span className="trend-diff"> ({trendInfo.diff}pp over last {Math.min(3, campaigns.length)} campaigns)</span>}
            </span>
          </div>
        )}

        {/* Graph area */}
        <div className="topGraph" style={{ width: "100%", height: 300, marginTop: "20px", marginBottom: "40px" }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="name" tick={{ fill: "#aaa", fontSize: 12 }} />
              <YAxis tick={{ fill: "#aaa", fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                cursor={{ stroke: "#555", strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const rate = payload.find(p => p.dataKey === "ClickRate")?.value ?? 0;
                  const clicks = payload.find(p => p.dataKey === "clicks")?.value ?? 0;
                  const sent = payload.find(p => p.dataKey === "sent")?.value ?? 0;
                  return (
                    <div style={{
                      backgroundColor: "#1e1e26",
                      border: "1px solid #444",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      fontSize: "13px"
                    }}>
                      <p style={{ color: "#aaa", margin: "0 0 6px 0" }}>{label}</p>
                      <p style={{ color: "#ddd", margin: 0 }}>
                        {rate}%
                        <span style={{ color: "#888", marginLeft: "8px" }}>
                          ({clicks} clicked / {sent} sent)
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="ClickRate"
                stroke="#00e5ff"
                strokeWidth={2}
                dot={{ r: 4, fill: "#00e5ff" }}
                activeDot={{ r: 6 }}
              />
              <Line dataKey="clicks" stroke="transparent" strokeWidth={0} dot={false} activeDot={false} legendType="none" />
              <Line dataKey="sent" stroke="transparent" strokeWidth={0} dot={false} activeDot={false} legendType="none" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Insights Row: At-Risk + Department Risk */}
        <div className="insights-row">

          {/* At-Risk Employees */}
          <div className="insight-card">
            <p className="insight-card-header">Most At-Risk Employees</p>
            {atRisk.length === 0 ? (
              <p className="insight-empty">No click data yet</p>
            ) : (
              <ul className="at-risk-list">
                {atRisk.map((r, i) => (
                  <li key={r.id} className="at-risk-item">
                    <div className="at-risk-rank">{i + 1}</div>
                    <div className="at-risk-info">
                      <p className="at-risk-name">
                        {[r.firstName, r.lastName].filter(Boolean).join(" ") || r.email}
                      </p>
                      <p className="at-risk-meta">
                        {r.department || "No dept"} · {r.campaigns_targeted} campaign{r.campaigns_targeted !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="at-risk-clicks">
                      <span className="at-risk-click-count">{r.total_clicks}</span>
                      <span className="at-risk-click-label">clicks</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Department Risk Breakdown */}
          <div className="insight-card">
            <p className="insight-card-header">Click Rate by Department</p>
            {deptRisk.length === 0 ? (
              <p className="insight-empty">No department data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={deptRisk.map(d => ({ ...d, click_rate: Number(d.click_rate) }))}
                  margin={{ top: 8, right: 16, left: 0, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                  <XAxis
                    dataKey="department"
                    tick={{ fill: "#aaa", fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#aaa", fontSize: 11 }}
                    unit="%"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1e26", border: "1px solid #444", borderRadius: "8px" }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#ddd" }}
                    formatter={(val) => [`${val}%`, "Click Rate"]}
                  />
                  <Bar dataKey="click_rate" radius={[4, 4, 0, 0]}>
                    {deptRisk.map((entry, index) => (
                      <Cell key={index} fill={getBarColor(Number(entry.click_rate))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>

        {/* End sticky charts section */}
        </div>

        {/* Campaign table */}
        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
            <h2 style={{ margin: 0 }}>Past Campaigns</h2>
            <button onClick={fetchCampaigns} className="ap-button" style={{ padding: "6px 14px", fontSize: "13px" }}>Refresh</button>
          </div>
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Emails Sent</th>
                <th>Clicks</th>
                <th>Click Rate</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#aaa" }}>No campaigns yet</td></tr>
              )}
              {campaigns.map(campaign => {
                const clickRate = Number(campaign.emails_sent) > 0
                  ? Math.round((Number(campaign.total_clicks) / Number(campaign.emails_sent)) * 100)
                  : 0;
                return (
                <>
                  <tr
                    key={campaign.id}
                    onClick={() => handleRowClick(campaign.id)}
                    className={expandedCampaignId === campaign.id ? "row-expanded" : ""}
                  >
                    <td>
                      <span className="expand-icon">
                        {expandedCampaignId === campaign.id ? "▾" : "▸"}
                      </span>
                      {campaign.name}
                    </td>
                    <td>{campaign.emails_sent}</td>
                    <td>{campaign.total_clicks}</td>
                    <td>{clickRate}%</td>
                    <td>{new Date(campaign.created_at).toLocaleDateString()}</td>
                  </tr>
                  {expandedCampaignId === campaign.id && (
                    <tr key={`${campaign.id}-detail`} className="recipient-detail-row">
                      <td colSpan={5}>
                        {loadingRecipients && !recipientsCache[campaign.id] ? (
                          <p style={{ color: "#aaa", margin: "8px 0" }}>Loading recipients...</p>
                        ) : (
                          <div className="recipient-table-scroll">
                            <table className="recipient-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Department</th>
                                  <th>Job Title</th>
                                  <th>Clicked</th>
                                  <th>Total Clicks</th>
                                  <th>Last Clicked</th>
                                  <th>User Agent</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(recipientsCache[campaign.id] || []).length === 0 && (
                                  <tr><td colSpan={8} style={{ color: "#aaa" }}>No recipients found</td></tr>
                                )}
                                {[...(recipientsCache[campaign.id] || [])].sort((a, b) => Number(b.click_count) - Number(a.click_count)).map(r => (
                                  <tr key={r.id}>
                                    <td>
                                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                                      {r.highRisk ? <span className="high-risk-badge">HIGH RISK</span> : null}
                                    </td>
                                    <td>{r.email}</td>
                                    <td>{r.department || "—"}</td>
                                    <td>{r.jobTitle || "—"}</td>
                                    <td>
                                      {Number(r.click_count) > 0
                                        ? <span className="badge-clicked">Yes</span>
                                        : <span className="badge-not-clicked">No</span>}
                                    </td>
                                    <td>{r.click_count}</td>
                                    <td>{r.last_clicked_at ? new Date(r.last_clicked_at).toLocaleString() : "—"}</td>
                                    <td>
                                      {r.last_user_agent
                                        ? <span title={r.last_user_agent} className="ua-cell">{parseUA(r.last_user_agent)}</span>
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
