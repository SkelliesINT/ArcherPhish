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
const { PrismaClient } = require("@prisma/client");

const registerAIGenerateRoute = require("./aiGenerate");
const registerSendCampaignRoute = require("./sendCampaign");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const prisma = new PrismaClient();

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

    const user = await prisma.users.create({
      data: {
        email,
        password: hash,
      },
    });

    res.status(201).json({ message: "User registered", id: user.id });
  } catch (err) {
    if (err.code === "P2002" && err.meta?.target?.includes("email")) {
      // Prisma unique constraint violation
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
    // Find the user by email
    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role},
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, role: user.role},
    });
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
  const { firstName, lastName, email, department, jobTitle } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const recipient = await prisma.recipients.create({
      data: {
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        department: department || null,
        jobTitle: jobTitle || null,
      },
    });

    res.json({
      message: "Recipient added successfully",
      recipient,
    });
  } catch (err) {
    console.error("Failed to add recipient:", err);
    res.status(500).json({ error: "Failed to add recipient" });
  }
});

app.get("/api/recipients", async (req, res) => {
  try {
    const recipients = await prisma.recipients.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        jobTitle: true,
      },
    });

    res.json(recipients);
  } catch (err) {
    console.error("Recipient fetch error:", err);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
});

app.delete("/api/recipients/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.recipients.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Recipient removed" });
  } catch (err) {
    console.error("Failed to delete recipient:", err);
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
    const campaign = await prisma.campaigns.create({
      data: {
        name,
        difficulty, // will default to "medium" if not provided
      },
    });

    res.status(201).json({
      id: campaign.id,
      name: campaign.name,
      difficulty: campaign.difficulty,
    });
  } catch (err) {
    console.error("Campaign creation error:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

app.get("/api/campaigns/:id/recipients", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.first_name AS firstName,
        r.last_name AS lastName,
        r.email,
        r.department,
        r.job_title AS jobTitle,
        COUNT(le.id) AS click_count,
        MAX(le.created_at) AS last_clicked_at,
        (SELECT le2.user_agent FROM link_events le2
         WHERE le2.phishing_link_id = pl.id
         ORDER BY le2.created_at DESC LIMIT 1) AS last_user_agent
      FROM phishing_links pl
      JOIN recipients r ON r.id = pl.recipient_id
      LEFT JOIN link_events le ON le.phishing_link_id = pl.id
      WHERE pl.campaign_id = ?
      GROUP BY pl.id, r.id
      ORDER BY r.last_name, r.first_name
    `, [id]);
    res.json(rows);
  } catch (err) {
    console.error("Campaign recipients fetch error:", err);
    res.status(500).json({ error: "Failed to fetch campaign recipients" });
  }
});

app.get("/api/campaigns", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.name, c.difficulty, c.created_at,
        COUNT(DISTINCT pl.id) AS emails_sent,
        COUNT(DISTINCT le.id) AS total_clicks
      FROM campaigns c
      LEFT JOIN phishing_links pl ON pl.campaign_id = c.id
      LEFT JOIN link_events le ON le.phishing_link_id = pl.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
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

  const trackingId = generateTrackingId();

  try {
    const result = await prisma.$transaction(async (prisma) => {
      // Check if recipient exists
      let recipient = await prisma.recipients.findUnique({
        where: { email },
      });

      if (!recipient) {
        // Create recipient
        recipient = await prisma.recipients.create({
          data: { firstName, lastName, email },
        });
      }

      // Create phishing link
      const phishingLink = await prisma.phishing_links.create({
        data: {
          campaign_id: parseInt(campaignId),
          recipient_id: recipient.id,
          tracking_id: trackingId,
        },
      });

      return phishingLink;
    });

    res.status(201).json({
      message: "Recipient added to campaign",
      trackingLink: `${process.env.BASE_URL || "http://localhost:4000"}/r/${trackingId}`,
    });
  } catch (err) {
    console.error("Campaign recipient error:", err);
    res.status(500).json({ error: "Failed to add recipient to campaign" });
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

app.post("/api/links", async (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    const id = genId(7);
    const link = await prisma.phishing_links.create({
      data: {
        tracking_id: id,
        campaign_id: 0, 
        recipient_id: 0,
        created_at: new Date(),
      },
    });

    res.json({ id, shortUrl: `/r/${id}`, target: url, name: name || null });
  } catch (err) {
    console.error("Link creation error:", err);
    res.status(500).json({ error: "Failed to create link" });
  }
});

// Unified redirect: check flat-file first, then DB campaign links
app.get("/r/:linkId", async (req, res) => {
  const { linkId } = req.params;

  // --- Flat-file first ---
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

  // --- Fall back to DB using Prisma ---
  try {
    const phishingLink = await prisma.phishing_links.findUnique({
      where: { tracking_id: linkId },
      select: { id: true },
    });

    if (!phishingLink) return res.status(404).send("Link not found");

    // Record the click event
    await prisma.link_events.create({
      data: {
        phishing_link_id: phishingLink.id,
        ip_address: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        user_agent: req.headers["user-agent"] || "",
        created_at: new Date(),
      },
    });

    // Redirect to your default target (update as needed)
    res.redirect(302, "https://example.com");
  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).send("Server error");
  }
});

// Unified analytics: check flat-file first, then DB
app.get("/api/analytics/:linkId", async (req, res) => {
  const { linkId } = req.params;

  // --- Flat-file first ---
  const links = loadLinks();
  if (links[linkId]) {
    const data = fs
      .readFileSync(CLICKS_FILE, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    const clicks = data
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((c) => c.linkId === linkId);

    const perDay = {};
    const uaCounts = {};
    clicks.forEach((c) => {
      const day = c.at.slice(0, 10);
      perDay[day] = (perDay[day] || 0) + 1;
      const ua = c.ua || "unknown";
      uaCounts[ua] = (uaCounts[ua] || 0) + 1;
    });

    const uniqueIps = new Set(clicks.map((c) => c.ipHash)).size;

    return res.json({
      link: links[linkId],
      totalClicks: clicks.length,
      uniqueUsers: uniqueIps,
      perDay,
      uaCounts,
    });
  }

  // --- Fall back to DB using Prisma ---
  try {
    const link = await prisma.phishing_links.findUnique({
      where: { tracking_id: linkId },
      select: {
        id: true,
        tracking_id: true,
        campaign: { select: { name: true } },
        recipient: { select: { firstName: true, lastName: true } },
      },
    });

    if (!link) return res.status(404).json({ error: "Link not found" });

    // Fetch clicks grouped by day
    const clicks = await prisma.link_events.groupBy({
      by: ["created_at"],
      where: { phishing_link_id: link.id },
      _count: { created_at: true },
    });

    // Count unique IPs
    const uniqueUsers = await prisma.link_events.count({
      where: { phishing_link_id: link.id },
      distinct: ["ip_address"],
    });

    // Build perDay object
    const perDay = {};
    clicks.forEach((c) => {
      const day = c.created_at.toISOString().slice(0, 10);
      perDay[day] = c._count.created_at;
    });

    res.json({
      link: {
        id: link.tracking_id,
        name: link.campaign.name,
        employee: `${link.recipient.firstName} ${link.recipient.lastName}`,
      },
      totalClicks: Object.values(perDay).reduce((sum, val) => sum + val, 0),
      uniqueUsers,
      perDay,
      uaCounts: {}, // You could extend this later with UA tracking
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

// =====================================================
// ANALYTICS INSIGHTS
// =====================================================

// Top 5 most-clicked recipients across all campaigns
app.get("/api/analytics/at-risk", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.first_name AS firstName,
        r.last_name AS lastName,
        r.email,
        r.department,
        COUNT(DISTINCT pl.campaign_id) AS campaigns_targeted,
        COUNT(le.id) AS total_clicks
      FROM recipients r
      JOIN phishing_links pl ON pl.recipient_id = r.id
      LEFT JOIN link_events le ON le.phishing_link_id = pl.id
      GROUP BY r.id, r.first_name, r.last_name, r.email, r.department
      HAVING total_clicks > 0
      ORDER BY total_clicks DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (err) {
    console.error("At-risk fetch error:", err);
    res.status(500).json({ error: "Failed to fetch at-risk employees" });
  }
});

// Click rate broken down by department
app.get("/api/analytics/department-risk", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(r.department), ''), 'Unknown') AS department,
        COUNT(DISTINCT pl.id) AS emails_sent,
        COUNT(le.id) AS total_clicks,
        ROUND(COUNT(le.id) / COUNT(DISTINCT pl.id) * 100, 1) AS click_rate
      FROM recipients r
      JOIN phishing_links pl ON pl.recipient_id = r.id
      LEFT JOIN link_events le ON le.phishing_link_id = pl.id
      GROUP BY COALESCE(NULLIF(TRIM(r.department), ''), 'Unknown')
      HAVING emails_sent > 0
      ORDER BY click_rate DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Department risk fetch error:", err);
    res.status(500).json({ error: "Failed to fetch department risk" });
  }
});

registerAIGenerateRoute(app);
registerSendCampaignRoute(app, db, prisma);

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
