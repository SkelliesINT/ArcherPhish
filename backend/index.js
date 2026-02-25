require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const registerAIGenerateRoute = require("./aiGenerate");
const registerSendCampaignRoute = require("./sendCampaign");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ------------------------------
// MySQL Connection Pool
// ------------------------------
const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

console.log("✅ MySQL connection pool created");

// =====================================================
// AUTH
// =====================================================

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hash]
    );
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, email, password FROM users WHERE email = ?",
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Dashboard (protected)
app.get("/api/dashboard", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    res.json({ message: "Welcome back!", user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// =====================================================
// RECIPIENTS
// =====================================================

app.post("/api/recipients", async (req, res) => {
  const { firstName, lastName, email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const [result] = await db.query(
      "INSERT INTO recipients (first_name, last_name, email) VALUES (?, ?, ?)",
      [firstName || "", lastName || "", email]
    );
    res.json({
      message: "Recipient added successfully",
      recipient: { id: result.insertId, firstName, lastName, email },
    });
  } catch (err) {
    console.error("Failed to add recipient:", err);
    res.status(500).json({ error: "Failed to add recipient" });
  }
});

app.get("/api/recipients", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, first_name, last_name, email FROM recipients"
    );
    res.json(rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
    })));
  } catch (err) {
    console.error("Recipient fetch error:", err);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
});

app.delete("/api/recipients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM recipients WHERE id = ?", [id]);
    res.json({ message: "Recipient removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete recipient" });
  }
});

// =====================================================
// CAMPAIGNS
// =====================================================

app.post("/api/campaigns", async (req, res) => {
  const { name, difficulty = "medium" } = req.body;
  if (!name) return res.status(400).json({ error: "Campaign name required" });

  try {
    const [result] = await db.query(
      "INSERT INTO campaigns (name, difficulty) VALUES (?, ?)",
      [name, difficulty]
    );
    res.status(201).json({ id: result.insertId, name, difficulty });
  } catch (err) {
    console.error("Campaign creation error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

app.get("/api/campaigns", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, difficulty, created_at FROM campaigns ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Campaign fetch error:", err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// =====================================================
// ADD RECIPIENT TO CAMPAIGN (AUTO LINK GENERATION)
// =====================================================

function generateTrackingId() {
  return crypto.randomBytes(24).toString("hex"); // 192-bit secure
}

app.post("/api/campaigns/:campaignId/recipients", async (req, res) => {
  const { firstName = "", lastName = "", email } = req.body;
  const { campaignId } = req.params;

  if (!email) return res.status(400).json({ error: "Email required" });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let [existing] = await connection.query(
      "SELECT id FROM recipients WHERE email = ?",
      [email]
    );

    let recipientId;

    if (existing.length) {
      recipientId = existing[0].id;
    } else {
      const [insertResult] = await connection.query(
        "INSERT INTO recipients (first_name, last_name, email) VALUES (?, ?, ?)",
        [firstName, lastName, email]
      );
      recipientId = insertResult.insertId;
    }

    const trackingId = generateTrackingId();

    await connection.query(
      "INSERT INTO phishing_links (campaign_id, recipient_id, tracking_id) VALUES (?, ?, ?)",
      [campaignId, recipientId, trackingId]
    );

    await connection.commit();

    res.status(201).json({
      message: "Recipient added to campaign",
      trackingLink: `${process.env.BASE_URL || "http://localhost:4000"}/r/${trackingId}`,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Campaign recipient error:", err);
    res.status(500).json({ error: "Failed to add recipient to campaign" });
  } finally {
    connection.release();
  }
});

// =====================================================
// FLAT-FILE LINK ANALYTICS (retained from beta-buildtwo)
// =====================================================

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const LINKS_FILE = path.join(DATA_DIR, "links.json");
const CLICKS_FILE = path.join(DATA_DIR, "clicks.ndjson");
if (!fs.existsSync(LINKS_FILE)) fs.writeFileSync(LINKS_FILE, JSON.stringify({}), "utf8");
if (!fs.existsSync(CLICKS_FILE)) fs.writeFileSync(CLICKS_FILE, "", "utf8");

function saveLinks(obj) { fs.writeFileSync(LINKS_FILE, JSON.stringify(obj, null, 2), "utf8"); }
function loadLinks() { try { return JSON.parse(fs.readFileSync(LINKS_FILE, "utf8") || "{}"); } catch { return {}; } }
function appendClick(clickObj) { fs.appendFile(CLICKS_FILE, JSON.stringify(clickObj) + "\n", err => { if (err) console.error("Failed to write click:", err); }); }
function genId(length = 6) { return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString("base64url").slice(0, length); }
function hashIp(ip) { return crypto.createHash("sha256").update(ip || "").digest("hex"); }
function getClientIp(req) { const forwarded = req.headers["x-forwarded-for"]; if (forwarded) return forwarded.split(",")[0].trim(); return req.socket.remoteAddress || ""; }

app.post("/api/links", (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  const links = loadLinks();
  const id = genId(7);
  links[id] = { id, url, name: name || null, createdAt: new Date().toISOString() };
  saveLinks(links);
  res.json({ id, shortUrl: `/r/${id}`, target: url });
});

// Unified redirect: check flat-file first, then DB campaign links
app.get("/r/:linkId", async (req, res) => {
  const { linkId } = req.params;

  // Try flat-file links first (short base64url IDs)
  const links = loadLinks();
  if (links[linkId]) {
    const link = links[linkId];
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const ua = req.headers["user-agent"] || "";
    const ref = req.headers.referer || req.headers.referrer || null;
    appendClick({ linkId, at: new Date().toISOString(), ua, ref, ipHash });
    return res.redirect(302, link.url);
  }

  // Fall back to DB campaign tracking links (long hex IDs)
  try {
    const [rows] = await db.query(
      "SELECT id FROM phishing_links WHERE tracking_id = ?",
      [linkId]
    );

    if (!rows.length) return res.status(404).send("Link not found");

    const phishingLinkId = rows[0].id;

    await db.query(
      "INSERT INTO link_events (phishing_link_id, ip_address, user_agent) VALUES (?, ?, ?)",
      [
        phishingLinkId,
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        req.headers["user-agent"] || "",
      ]
    );

    res.redirect(302, "https://example.com");
  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).send("Server error");
  }
});

// Unified analytics: check flat-file first, then DB
app.get("/api/analytics/:linkId", async (req, res) => {
  const { linkId } = req.params;

  // Try flat-file first
  const links = loadLinks();
  if (links[linkId]) {
    const data = fs.readFileSync(CLICKS_FILE, "utf8").trim().split("\n").filter(Boolean);
    const clicks = data.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).filter(c => c.linkId === linkId);

    const perDay = {}, uaCounts = {};
    clicks.forEach(c => {
      const day = c.at.slice(0, 10);
      perDay[day] = (perDay[day] || 0) + 1;
      const ua = c.ua || "unknown";
      uaCounts[ua] = (uaCounts[ua] || 0) + 1;
    });

    const uniqueIps = new Set(clicks.map(c => c.ipHash)).size;
    return res.json({ link: links[linkId], totalClicks: clicks.length, uniqueUsers: uniqueIps, perDay, uaCounts });
  }

  // Fall back to DB
  try {
    const [[link]] = await db.query(
      `SELECT pl.id, pl.tracking_id,
              c.name AS campaign_name,
              r.first_name, r.last_name
       FROM phishing_links pl
       JOIN recipients r ON r.id = pl.recipient_id
       JOIN campaigns c ON c.id = pl.campaign_id
       WHERE pl.tracking_id = ?`,
      [linkId]
    );

    if (!link) return res.status(404).json({ error: "Link not found" });

    const [clicks] = await db.query(
      "SELECT DATE(created_at) AS day, COUNT(*) AS count FROM link_events WHERE phishing_link_id = ? GROUP BY day",
      [link.id]
    );

    const [unique] = await db.query(
      "SELECT COUNT(DISTINCT ip_address) AS uniqueUsers FROM link_events WHERE phishing_link_id = ?",
      [link.id]
    );

    const perDay = {};
    clicks.forEach(c => (perDay[c.day] = c.count));

    res.json({
      link: {
        id: link.tracking_id,
        name: link.campaign_name,
        employee: `${link.first_name} ${link.last_name}`,
      },
      totalClicks: clicks.reduce((s, c) => s + c.count, 0),
      uniqueUsers: unique[0].uniqueUsers,
      perDay,
      uaCounts: {},
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

app.get("/api/links", (req, res) => { res.json(loadLinks()); });

app.delete("/api/links/:linkId", (req, res) => {
  const { linkId } = req.params;
  const links = loadLinks();

  if (!links[linkId]) {
    return res.status(404).json({ error: "Link not found" });
  }

  delete links[linkId];
  saveLinks(links);
  res.json({ message: "Link deleted successfully" });
});

// =====================================================
// NEWS API
// =====================================================

app.get("/api/news", async (req, res) => {
  const topic = req.query.q || "phishing";
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing NEWS_API_KEY in backend" });
  }

  try {
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: { q: topic, language: "en", pageSize: 12, apiKey },
    });

    const articles = response.data.articles.map(article => ({
      title: article.title,
      link: article.url,
      published: article.publishedAt,
      source: article.source.name,
      image: article.urlToImage,
      description: article.description,
    }));

    res.json(articles);
  } catch (err) {
    console.error("NewsAPI error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

registerAIGenerateRoute(app);
registerSendCampaignRoute(app, db);

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
