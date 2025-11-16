// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const registerAIGenerateRoute = require('./aiGenerate');
const registerSendCampaignRoute = require('./sendCampaign');

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
registerAIGenerateRoute(app);
registerSendCampaignRoute(app, db);

app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
