require("dotenv").config();

// if no DATABASE_URL provided, fall back to a lightweight SQLite file for ease of
// default development (avoids requiring a running MySQL server)
if (!process.env.DATABASE_URL) {
  process.env.DB_PROVIDER = process.env.DB_PROVIDER || "sqlite";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
  console.log("ℹ️  Falling back to SQLite database at ./dev.db");
}

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

const app = express();
const PORT = process.env.PORT || 4000;

// Allow local frontend ports (3000 and 3002) during development
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser requests (curl, Postman) when origin is undefined
      if (!origin) return cb(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

const prisma = new PrismaClient();

// Helper: automatically apply Prisma schema and seed a default user on startup
async function prepareDatabase() {
  // only attempt if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  No DATABASE_URL defined in environment; login will not work until you set it.");
    return;
  }

  try {
    // push schema (safe for dev); migrations are run by npm script normally
    console.log("🔄 Applying Prisma schema to database (db push)...");
    const { execSync } = require("child_process");
    execSync("npx prisma db push", { stdio: "inherit" });
  } catch (err) {
    console.error("Failed to apply Prisma schema:", err.message || err);
  }

  try {
    const count = await prisma.users.count();
    if (count === 0) {
      console.log("🛠 No users found, creating default development account");
      const hash = await bcrypt.hash("Password123!", 10);
      await prisma.users.create({
        data: { email: "dev@example.com", password: hash, role: "admin" },
      });
      console.log("✅ Created user dev@example.com with password Password123!");
    }
  } catch (err) {
    console.error("Error seeding default user:", err);
  }
}


// ------------------------------
// MySQL Connection Pool (only used by some legacy routines)
// ------------------------------
let db = null;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("mysql://")) {
  db = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });
  console.log("✅ MySQL connection pool created");
} else {
  console.log("ℹ️  MySQL pool skipped (no mysql URL or not a mysql connection string)");
}

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
// NEWS (Curated phishing awareness articles)
// =====================================================

const PHISHING_NEWS = [
  {
    title: "CISA Releases Cybersecurity Advisory on SMS Phishing Tactics",
    description: "Federal cybersecurity agency warns about evolving SMS-based phishing campaigns targeting government and enterprise users.",
    link: "https://www.cisa.gov/",
    image: "https://via.placeholder.com/400x200?text=CISA+Advisory",
    source: "CISA",
    published: new Date("2025-12-15")
  },
  {
    title: "Email Phishing Campaigns Increase 45% in Q4 2025",
    description: "Security researchers report a significant surge in phishing emails using AI-generated content and deepfake techniques.",
    link: "https://www.securityaffairs.co/",
    image: "https://via.placeholder.com/400x200?text=Email+Security",
    source: "Security Affairs",
    published: new Date("2025-12-10")
  },
  {
    title: "Recognizing Phishing: A Guide for Employees",
    description: "Learn how to identify common phishing tactics including urgent language, suspicious links, and spoofed senders.",
    link: "https://www.knowbe4.com/",
    image: "https://via.placeholder.com/400x200?text=Employee+Training",
    source: "KnowBe4",
    published: new Date("2025-12-08")
  },
  {
    title: "Multi-Factor Authentication Prevents 99.9% of Account Takeovers",
    description: "Study shows MFA effectiveness in preventing unauthorized access even after successful phishing attacks.",
    link: "https://www.microsoft.com/security/",
    image: "https://via.placeholder.com/400x200?text=MFA+Security",
    source: "Microsoft",
    published: new Date("2025-12-05")
  },
  {
    title: "New Phishing Technique: Deepfake Voice Calls",
    description: "Attackers are now using AI-generated voice in phishing campaigns, impersonating executives and authority figures.",
    link: "https://www.infosecurity-magazine.com/",
    image: "https://via.placeholder.com/400x200?text=Voice+Phishing",
    source: "Infosecurity Magazine",
    published: new Date("2025-12-01")
  },
  {
    title: "Credential Stuffing Attacks Spike During Holiday Season",
    description: "Cybersecurity teams report increased automated login attempts using stolen credentials from previous breaches.",
    link: "https://www.darkreading.com/",
    image: "https://via.placeholder.com/400x200?text=Credential+Attack",
    source: "Dark Reading",
    published: new Date("2025-11-28")
  }
];

app.get("/api/news", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  
  let filtered = PHISHING_NEWS;
  if (q && q !== "phishing") {
    filtered = PHISHING_NEWS.filter(article => 
      article.title.toLowerCase().includes(q) ||
      article.description.toLowerCase().includes(q)
    );
  }
  
  res.json(filtered);
});

// =====================================================
// RECIPIENTS
// =====================================================

app.post("/api/recipients", async (req, res) => {
  const { firstName, lastName, email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const recipient = await prisma.recipients.create({
      data: {
        firstName: firstName || "",
        lastName: lastName || "",
        email,
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
// CSV IMPORT/EXPORT
// =====================================================

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/recipients/import - Upload and parse CSV
app.post("/api/recipients/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const csvText = req.file.buffer.toString("utf-8");
    const records = parse(csvText, { columns: true, skip_empty_lines: true });

    if (!records || records.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Expected columns: firstName, lastName, email (case-insensitive)
    const results = { success: 0, failed: 0, errors: [] };
    const created = [];

    for (const record of records) {
      const firstName = (record.firstName || record.first_name || "").trim();
      const lastName = (record.lastName || record.last_name || "").trim();
      const email = (record.email || "").trim().toLowerCase();

      if (!email) {
        results.failed++;
        results.errors.push({ row: record, error: "Missing email" });
        continue;
      }

      try {
        const recipient = await prisma.recipients.create({
          data: { firstName, lastName, email },
        });
        created.push(recipient);
        results.success++;
      } catch (err) {
        if (err.code === "P2002") {
          // Email already exists
          results.failed++;
          results.errors.push({ row: record, error: "Email already exists" });
        } else {
          results.failed++;
          results.errors.push({ row: record, error: err.message });
        }
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
app.get("/api/recipients/export", async (req, res) => {
  try {
    // Fetch all recipients
    const recipients = await prisma.recipients.findMany();

    // For each recipient, fetch their phishing links and related campaigns/events
    const enrichedData = [];
    for (const recipient of recipients) {
      const phishingLinks = await prisma.phishing_links.findMany({
        where: { recipient_id: recipient.id },
        include: {
          campaign: true,
          link_events: true,
        },
      });

      // Collect campaign info
      const campaigns = phishingLinks
        .map((link) => link.campaign?.name || "Unknown")
        .filter((name, idx, arr) => arr.indexOf(name) === idx); // unique
      const campaignsTargeted = campaigns.length > 0 ? campaigns.join("; ") : "None";

      // Collect clicking info
      const clickedCampaigns = phishingLinks
        .filter((link) => link.link_events && link.link_events.length > 0)
        .map((link) => link.campaign?.name || "Unknown")
        .filter((name, idx, arr) => arr.indexOf(name) === idx); // unique
      const campaignsClicked = clickedCampaigns.length > 0 ? clickedCampaigns.join("; ") : "None";

      // Total clicks
      const totalClicks = phishingLinks.reduce((sum, link) => sum + (link.link_events?.length || 0), 0);

      // First and last click dates
      const allClickDates = phishingLinks
        .flatMap((link) => link.link_events || [])
        .map((event) => new Date(event.created_at))
        .sort((a, b) => a - b);

      const firstClickDate = allClickDates.length > 0 ? allClickDates[0].toISOString().split("T")[0] : "N/A";
      const lastClickDate = allClickDates.length > 0 ? allClickDates[allClickDates.length - 1].toISOString().split("T")[0] : "N/A";

      enrichedData.push({
        firstName: recipient.firstName || "",
        lastName: recipient.lastName || "",
        email: recipient.email || "",
        campaignsTargeted,
        campaignsClicked,
        totalClicks,
        firstClickDate,
        lastClickDate,
      });
    }

    // Build CSV
    const headers = ["firstName", "lastName", "email", "campaigns_targeted", "campaigns_clicked", "total_clicks", "first_click_date", "last_click_date"];
    const csvLines = [headers.join(",")];

    for (const row of enrichedData) {
      const cols = [
        `"${row.firstName.replace(/"/g, '""')}"`,
        `"${row.lastName.replace(/"/g, '""')}"`,
        `"${row.email.replace(/"/g, '""')}"`,
        `"${row.campaignsTargeted.replace(/"/g, '""')}"`,
        `"${row.campaignsClicked.replace(/"/g, '""')}"`,
        row.totalClicks,
        `"${row.firstClickDate}"`,
        `"${row.lastClickDate}"`,
      ];
      csvLines.push(cols.join(","));
    }

    const csv = csvLines.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=campaign_results.csv");
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: `Failed to export campaign results: ${err.message}` });
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

app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await prisma.campaigns.findMany({
      orderBy: { created_at: "desc" }, // order by created_at descending
      select: {
        id: true,
        name: true,
        difficulty: true,
        created_at: true,
      },
    });

    res.json(campaigns);
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

registerAIGenerateRoute(app);
registerSendCampaignRoute(app);

// start listening once preparation has had a chance to run
prepareDatabase().then(() => {
  app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error("Failed to start server due to database preparation error:", err);
});
