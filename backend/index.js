require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) console.error('❌ Database connection failed:', err);
  else console.log('✅ Connected to MySQL');
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (email, password) VALUES (?, ?)';
    db.query(sql, [email, hash], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' });
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
      }
      res.status(201).json({ message: 'User registered', id: result.insertId });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to add a recipient
app.post("/api/recipients", (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  const sql = "INSERT INTO recipients (email) VALUES (?)";
  db.query(sql, [email], (err, result) => {
    if (err) {
      console.error("Failed to add recipient:", err);
      return res.status(500).json({ error: "Failed to add recipient" });
    }
    res.status(201).json({ message: "Recipient added", id: result.insertId });
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const sql = 'SELECT id, email, password FROM users WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email } });
  });
});

// Example protected route
app.get('/api/dashboard', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    res.json({ message: 'Protected dashboard data', user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});


// === ADDED BY ZACH: Link analytics (safe, local storage) ===
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Data directory & files
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const LINKS_FILE = path.join(DATA_DIR, 'links.json');
const CLICKS_FILE = path.join(DATA_DIR, 'clicks.ndjson');

// ensure files exist
if (!fs.existsSync(LINKS_FILE)) fs.writeFileSync(LINKS_FILE, JSON.stringify({}), 'utf8');
if (!fs.existsSync(CLICKS_FILE)) fs.writeFileSync(CLICKS_FILE, '', 'utf8');

// helpers
function saveLinks(obj) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
function loadLinks() {
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}
function appendClick(clickObj) {
  const line = JSON.stringify(clickObj) + '\n';
  fs.appendFile(CLICKS_FILE, line, err => {
    if (err) console.error('Failed to write click:', err);
  });
}
function genId(length = 6) {
  return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64url').slice(0, length);
}
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex');
}
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

// Create a new tracked link
// POST /api/links
// body: { url: "https://example.com", name?: "Campaign" }
app.post('/api/links', (req, res) => {
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const links = loadLinks();
  const id = genId(7);
  links[id] = {
    id,
    url,
    name: name || null,
    createdAt: new Date().toISOString()
  };
  saveLinks(links);
  res.json({ id, shortUrl: `/r/${id}`, target: url });
});

// Redirect endpoint that logs click then redirects
app.get('/r/:linkId', (req, res) => {
  const { linkId } = req.params;
  const links = loadLinks();
  const link = links[linkId];
  if (!link) return res.status(404).send('Link not found');

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const ua = req.headers['user-agent'] || '';
  const ref = req.headers.referer || req.headers.referrer || null;

  const click = {
    linkId,
    at: new Date().toISOString(),
    ua,
    ref,
    ipHash
  };

  appendClick(click);
  res.redirect(302, link.url);
});

// Analytics: aggregated stats for a link
app.get('/api/analytics/:linkId', (req, res) => {
  const { linkId } = req.params;
  const links = loadLinks();
  if (!links[linkId]) return res.status(404).json({ error: 'Link not found' });

  const data = fs.readFileSync(CLICKS_FILE, 'utf8').trim().split('\n').filter(Boolean);
  const clicks = data.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).filter(c => c.linkId === linkId);

  const total = clicks.length;

  // clicks per day
  const perDay = {};
  const uaCounts = {};
  clicks.forEach(c => {
    const day = c.at.slice(0, 10);
    perDay[day] = (perDay[day] || 0) + 1;
    const ua = c.ua || 'unknown';
    uaCounts[ua] = (uaCounts[ua] || 0) + 1;
  });

  const uniqueIps = new Set(clicks.map(c => c.ipHash)).size;

  res.json({
    link: links[linkId],
    totalClicks: total,
    uniqueUsers: uniqueIps,
    perDay,
    uaCounts
  });
});

// List all links
app.get('/api/links', (req, res) => {
  res.json(loadLinks());
});
// === END ADDED BY ZACH ===


app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
