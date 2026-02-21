require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const registerAIGenerateRoute = require("./aiGenerate");
const registerSendCampaignRoute = require("./sendCampaign");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ------------------------------
// MySQL Pool
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

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// =====================================================
// RECIPIENTS (GLOBAL EMPLOYEES)
// =====================================================

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

// =====================================================
// CAMPAIGNS
// =====================================================

app.post("/api/campaigns", async (req, res) => {
  const { name, difficulty = "medium" } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Campaign name required" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO campaigns (name, difficulty) VALUES (?, ?)",
      [name, difficulty]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      difficulty,
    });

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

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check if recipient already exists
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
      `
      INSERT INTO phishing_links (campaign_id, recipient_id, tracking_id)
      VALUES (?, ?, ?)
      `,
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
// REDIRECT + CLICK TRACKING
// =====================================================

app.get("/r/:trackingId", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id FROM phishing_links WHERE tracking_id = ?",
      [req.params.trackingId]
    );

    if (!rows.length) {
      return res.status(404).send("Link not found");
    }

    const phishingLinkId = rows[0].id;

    await db.query(
      `
      INSERT INTO link_events (phishing_link_id, ip_address, user_agent)
      VALUES (?, ?, ?)
      `,
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

// =====================================================
// ANALYTICS
// =====================================================

app.get("/api/analytics/:trackingId", async (req, res) => {
  try {
    const [[link]] = await db.query(
      `
      SELECT pl.id, pl.tracking_id,
             c.name AS campaign_name,
             r.first_name, r.last_name
      FROM phishing_links pl
      JOIN recipients r ON r.id = pl.recipient_id
      JOIN campaigns c ON c.id = pl.campaign_id
      WHERE pl.tracking_id = ?
      `,
      [req.params.trackingId]
    );

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    const [clicks] = await db.query(
      `
      SELECT DATE(created_at) AS day, COUNT(*) AS count
      FROM link_events
      WHERE phishing_link_id = ?
      GROUP BY day
      `,
      [link.id]
    );

    const [unique] = await db.query(
      `
      SELECT COUNT(DISTINCT ip_address) AS uniqueUsers
      FROM link_events
      WHERE phishing_link_id = ?
      `,
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

// =====================================================

registerAIGenerateRoute(app);
registerSendCampaignRoute(app, db);

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
