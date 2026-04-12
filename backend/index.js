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
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

const registerAIGenerateRoute = require("./aiGenerate");
const registerSendCampaignRoute = require("./sendCampaign");
const registerSendHighRiskCampaignRoute = require("./sendHighRiskCampaign");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const prisma = new PrismaClient();

const { authenticateToken, requirePermission, requireAnyPermission} = require("./middleware");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET not defined in environment variables");
}

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
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    // Fetch the user and their roles & permissions
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        user_roles: {
          select: {
            role: {
              select: {
                name: true,
                role_permissions: {
                  select: {
                    permission: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const roles = user.user_roles.map(ur => ur.role.name);

    const permissions = user.user_roles.flatMap(ur =>
      ur.role.role_permissions.map(rp => rp.permission.name)
    );

    // Update users.roles column (optional, for convenience in the DB)
    const rolesString = roles.join(",");
    if (user.roles !== rolesString) {
      await prisma.users.update({
        where: { id: user.id },
        data: { roles: rolesString },
      });
    }

    // Build user object for frontend
    const frontendUser = {
      id: user.id,
      email: user.email,
      roles,        // array of role names
      permissions,  // array of permission names
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, roles, permissions },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1h" }
    );

    res.json({ token, user: frontendUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Dashboard (protected)
app.get("/api/dashboard", authenticateToken, (req, res) => {
  res.json({
    message: "Welcome back!",
    user: req.user
  });
});

// =====================================================
// RECIPIENTS
// =====================================================

app.post("/api/recipients", authenticateToken, requirePermission("manage_recipients"), async (req, res) => {
  const { firstName, lastName, email, department, jobTitle, highRisk, osintData } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const osintJson = (osintData && typeof osintData === "object") ? JSON.stringify(osintData) : null;

  try {
    const [result] = await db.query(
      `INSERT INTO recipients (first_name, last_name, email, department, job_title, high_risk, osint_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [firstName || "", lastName || "", email, department || null, jobTitle || null, highRisk ? 1 : 0, osintJson]
    );
    const [[recipient]] = await db.query(
      `SELECT id, first_name AS firstName, last_name AS lastName, email, department, job_title AS jobTitle, high_risk AS highRisk, osint_data AS osintData FROM recipients WHERE id=?`,
      [result.insertId]
    );
    recipient.highRisk = !!recipient.highRisk;
    recipient.osintData = recipient.osintData ? JSON.parse(recipient.osintData) : null;
    res.json({ message: "Recipient added successfully", recipient });
  } catch (err) {
    console.error("Failed to add recipient:", err);
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: "Failed to add recipient" });
  }
});

app.get("/api/recipients", authenticateToken, requirePermission("view_recipients"), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, first_name AS firstName, last_name AS lastName,
             email, department, job_title AS jobTitle, high_risk AS highRisk, osint_data AS osintData
      FROM recipients
      ORDER BY last_name, first_name
    `);
    res.json(rows.map(r => ({
      ...r,
      highRisk: !!r.highRisk,
      osintData: r.osintData ? JSON.parse(r.osintData) : null,
    })));
  } catch (err) {
    console.error("Recipient fetch error:", err);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
});

app.delete("/api/recipients/:id", authenticateToken, requirePermission("manage_recipients"), async (req, res) => {
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

app.put("/api/recipients/:id", authenticateToken,
  requirePermission("manage_recipients"), async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, department, jobTitle, highRisk, osintData } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const osintJson = (osintData && typeof osintData === "object") ? JSON.stringify(osintData) : null;

  try {
    await db.query(
      `UPDATE recipients SET first_name=?, last_name=?, email=?, department=?, job_title=?, high_risk=?, osint_data=? WHERE id=?`,
      [firstName || "", lastName || "", email, department || null, jobTitle || null, highRisk ? 1 : 0, osintJson, parseInt(id)]
    );
    const [[updated]] = await db.query(
      `SELECT id, first_name AS firstName, last_name AS lastName, email, department, job_title AS jobTitle, high_risk AS highRisk, osint_data AS osintData FROM recipients WHERE id=?`,
      [parseInt(id)]
    );
    updated.highRisk = !!updated.highRisk;
    updated.osintData = updated.osintData ? JSON.parse(updated.osintData) : null;
    res.json(updated);
  } catch (err) {
    console.error("Failed to update recipient:", err);
    res.status(500).json({ error: "Failed to update recipient" });
  }
});

app.patch("/api/recipients/:id/high-risk", authenticateToken,
  requirePermission("manage_recipients"), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`UPDATE recipients SET high_risk = NOT high_risk WHERE id=?`, [parseInt(id)]);
    const [[updated]] = await db.query(
      `SELECT id, high_risk AS highRisk FROM recipients WHERE id=?`,
      [parseInt(id)]
    );
    res.json(updated);
  } catch (err) {
    console.error("Failed to toggle high risk:", err);
    res.status(500).json({ error: "Failed to toggle high risk" });
  }
});

// =====================================================
// DEPARTMENTS
// =====================================================

app.get("/api/departments", authenticateToken,
  requirePermission("view_recipients"), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT name FROM departments
      UNION
      SELECT DISTINCT department AS name FROM recipients
        WHERE department IS NOT NULL AND TRIM(department) != ''
      ORDER BY name
    `);
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error("Departments fetch error:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

app.post("/api/departments", authenticateToken,
  requirePermission("manage_recipients"), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Department name required" });
  try {
    await db.query("INSERT IGNORE INTO departments (name) VALUES (?)", [name.trim()]);
    res.json({ name: name.trim() });
  } catch (err) {
    console.error("Department add error:", err);
    res.status(500).json({ error: "Failed to add department" });
  }
});

// =====================================================
// CSV IMPORT / EXPORT
// =====================================================

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/recipients/import - Upload and parse CSV
app.post("/api/recipients/import",
  authenticateToken,
  requirePermission("manage_recipients"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const csvText = req.file.buffer.toString("utf-8");
    const records = parse(csvText, { columns: true, skip_empty_lines: true });

    if (!records || records.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    const results = { success: 0, failed: 0, errors: [] };
    const created = [];

    for (const record of records) {
      const firstName = (record.firstName || record.first_name || "").trim();
      const lastName = (record.lastName || record.last_name || "").trim();
      const email = (record.email || "").trim().toLowerCase();
      const department = (record.department || "").trim();
      const jobTitle = (record.jobTitle || record.job_title || "").trim();

      if (!email) {
        results.failed++;
        results.errors.push({ row: record, error: "Missing email" });
        continue;
      }

      try {
        const recipient = await prisma.recipients.create({
          data: { firstName, lastName, email, department, jobTitle },
        });
        created.push(recipient);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: record,
          error: err.code === "P2002" ? "Email already exists" : err.message,
        });
      }
    }

    res.json({
      message: `CSV import complete: ${results.success} imported, ${results.failed} failed`,
      ...results,
      created,
    });
  } catch (err) {
    console.error("CSV import error:", err);
    res.status(500).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// GET /api/recipients/export - Download recipients with campaign engagement results
app.get("/api/recipients/export", authenticateToken, requirePermission("export_reports"), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.first_name AS firstName,
        r.last_name  AS lastName,
        r.email,
        r.department,
        r.job_title  AS jobTitle,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR '; ') AS campaignsTargeted,
        GROUP_CONCAT(DISTINCT CASE WHEN le.id IS NOT NULL THEN c.name END ORDER BY c.name SEPARATOR '; ') AS campaignsClicked,
        COUNT(le.id) AS totalClicks,
        MIN(le.created_at) AS firstClickDate,
        MAX(le.created_at) AS lastClickDate
      FROM recipients r
      LEFT JOIN phishing_links pl ON pl.recipient_id = r.id
      LEFT JOIN campaigns c ON c.id = pl.campaign_id
      LEFT JOIN link_events le ON le.phishing_link_id = pl.id
      GROUP BY r.id, r.first_name, r.last_name, r.email, r.department, r.job_title
      ORDER BY r.last_name, r.first_name
    `);

    const enrichedData = rows.map((r) => ({
      firstName: r.firstName || "",
      lastName: r.lastName || "",
      email: r.email || "",
      department: r.department || "",
      jobTitle: r.jobTitle || "",
      campaignsTargeted: r.campaignsTargeted || "None",
      campaignsClicked: r.campaignsClicked || "None",
      totalClicks: r.totalClicks || 0,
      firstClickDate: r.firstClickDate ? new Date(r.firstClickDate).toISOString().split("T")[0] : "N/A",
      lastClickDate: r.lastClickDate ? new Date(r.lastClickDate).toISOString().split("T")[0] : "N/A",
    }));

    const headers = ["firstName", "lastName", "email", "department", "jobTitle", "campaigns_targeted", "campaigns_clicked", "total_clicks", "first_click_date", "last_click_date"];
    const csvLines = [headers.join(",")];

    for (const row of enrichedData) {
      const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
      csvLines.push([
        esc(row.firstName), esc(row.lastName), esc(row.email),
        esc(row.department), esc(row.jobTitle),
        esc(row.campaignsTargeted), esc(row.campaignsClicked),
        row.totalClicks, esc(row.firstClickDate), esc(row.lastClickDate),
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=campaign_results.csv");
    res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: `Failed to export: ${err.message}` });
  }
});

// =====================================================
// CAMPAIGNS
// =====================================================

app.post("/api/campaigns", authenticateToken, requirePermission("manage_campaigns"), async (req, res) => {
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

app.get("/api/campaigns/:id/recipients",
  authenticateToken,
  requirePermission("view_campaigns"),
  requirePermission("view_recipients"), async (req, res) => {
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
        r.high_risk AS highRisk,
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

app.get("/api/campaigns", authenticateToken, requirePermission("view_campaigns"), async (req, res) => {
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

app.post("/api/campaigns/:campaignId/recipients", authenticateToken, 
  requirePermission("manage_campaigns"), async (req, res) => {
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

app.post("/api/links", authenticateToken,
requireAnyPermission(["manage_campaigns", "view_all_analytics"]), async (req, res) => {
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
  console.log(`[/r/:linkId] received linkId="${linkId}"`);

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

  // --- Fall back to DB ---
  try {
    const [[phishingLink]] = await db.query(`
      SELECT pl.id, COALESCE(c.redirect_to, 'google') AS redirect_to
      FROM phishing_links pl
      JOIN campaigns c ON c.id = pl.campaign_id
      WHERE pl.tracking_id = ?
    `, [linkId]);

    if (!phishingLink) return res.status(404).send("Link not found");

    // Record the click event
    await db.query(
      "INSERT INTO link_events (phishing_link_id, ip_address, user_agent) VALUES (?, ?, ?)",
      [
        phishingLink.id,
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        req.headers["user-agent"] || "",
      ]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUrl = phishingLink.redirect_to === "training"
      ? `${frontendUrl}/training`
      : "https://www.google.com";
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).send("Server error");
  }
});

// =====================================================
// ANALYTICS INSIGHTS
// =====================================================

// Top 5 most-clicked recipients across all campaigns
app.get("/api/analytics/at-risk",
  authenticateToken,
  requirePermission("view_at_risk_analytics"), async (req, res) => {
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
app.get("/api/analytics/department-risk",
  authenticateToken,
  requirePermission("view_department_analytics"), async (req, res) => {
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

// Unified analytics: check flat-file first, then DB
app.get("/api/analytics/:linkId", authenticateToken,
  requirePermission("view_all_analytics"), async (req, res) => {
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

app.get("/api/links", authenticateToken,
requireAnyPermission(["create_campaign","view_all_analytics"]), (req, res) => { res.json(loadLinks()); });

app.delete("/api/links/:linkId", authenticateToken,
  requirePermission("create_campaign"), (req, res) => {
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
registerSendCampaignRoute(app, db, prisma);
registerSendHighRiskCampaignRoute(app, db);

// =====================================================
// SETTINGS
// =====================================================

app.get("/api/settings",
  authenticateToken,
  requireAnyPermission(["view_campaigns", "view_recipients"]), async (_req, res) => {
  try {
    const [[row]] = await db.query("SELECT company_name FROM settings WHERE id = 1");
    res.json({ companyName: row ? row.company_name : "" });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/settings", authenticateToken,
  requirePermission("modify_system_settings"), async (req, res) => {
  try {
    const { companyName = "" } = req.body || {};
    await db.query(
      "INSERT INTO settings (id, company_name) VALUES (1, ?) ON DUPLICATE KEY UPDATE company_name = ?",
      [companyName, companyName]
    );
    res.json({ companyName });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Global error handler — ensures all unhandled errors return JSON, not HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const [colCheck] = await db.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'recipients'
        AND COLUMN_NAME = 'high_risk'
    `);
    if (colCheck[0].cnt === 0) {
      await db.query(`ALTER TABLE recipients ADD COLUMN high_risk TINYINT(1) NOT NULL DEFAULT 0`);
    }
    const [osintColCheck] = await db.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'recipients'
        AND COLUMN_NAME = 'osint_data'
    `);
    if (osintColCheck[0].cnt === 0) {
      await db.query(`ALTER TABLE recipients ADD COLUMN osint_data TEXT NULL`);
    }
    const [redirectColCheck] = await db.query(`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'campaigns'
        AND COLUMN_NAME = 'redirect_to'
    `);
    if (redirectColCheck[0].cnt === 0) {
      await db.query(`ALTER TABLE campaigns ADD COLUMN redirect_to VARCHAR(20) NOT NULL DEFAULT 'google'`);
    }
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT NOT NULL DEFAULT 1,
        company_name VARCHAR(200) NOT NULL DEFAULT '',
        PRIMARY KEY (id)
      )
    `);
    await db.query(`INSERT IGNORE INTO settings (id, company_name) VALUES (1, '')`);
    console.log("✅ DB migrations complete");
  } catch (err) {
    console.error("DB migration error:", err);
  }
  app.listen(PORT, async () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);

    // Auto-start ngrok if NGROK_AUTHTOKEN is set and BASE_URL is not already a public URL
    console.log(`[ngrok] NGROK_AUTHTOKEN set: ${!!process.env.NGROK_AUTHTOKEN}, BASE_URL: "${process.env.BASE_URL}"`);
    if (process.env.NGROK_AUTHTOKEN && (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost'))) {
      console.log('[ngrok] Starting tunnel...');
      try {
        const ngrok = require('@ngrok/ngrok');
        const listener = await ngrok.forward({ addr: PORT, authtoken: process.env.NGROK_AUTHTOKEN });
        process.env.BASE_URL = listener.url();
        console.log(`🌐 Ngrok tunnel active: ${process.env.BASE_URL}`);
        console.log(`🔗 Tracking links will use: ${process.env.BASE_URL}/r/<trackingId>`);
      } catch (err) {
        console.error('❌ Ngrok failed to start:', err.message);
        console.warn('   Tracking links will fall back to BASE_URL in .env or http://localhost:4000');
      }
    } else {
      console.log('[ngrok] Skipped — token missing or BASE_URL already set to a public URL');
    }
  });
})();
