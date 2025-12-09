// backend/sendCampaign.js
// Registers POST /api/send-campaign which sends the provided simulatedEmail to recipients in DB
const nodemailer = require('nodemailer');
const mysql = require("mysql2");
const pLimit = require('p-limit');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
if (!fs.existsSync(LINKS_FILE)) fs.writeFileSync(LINKS_FILE, JSON.stringify({}), 'utf8');

function loadLinks() { 
  try { 
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8') || '{}'); 
  } catch (e) { 
    console.error('Failed to load links:', e); 
    return {}; 
  } 
}


module.exports = function registerSendCampaignRoute(app, db) {
  if (!app) throw new Error('Express app required');
  if (!db) throw new Error('Database connection required');

  // create transporter from env (Gmail config example)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE === 'true') || false, // false for port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
  });

  // parse the simulated email into from/subject/body (tries JSON first)
  function parseSimulatedEmail(simulatedEmail) {
    try {
      const obj = JSON.parse(simulatedEmail);
      if (obj && (obj.subject || obj.body)) {
        return {
          from: obj.from || process.env.EMAIL_FROM,
          subject: obj.subject || '(No Subject)',
          body: obj.body || ''
        };
      }
    } catch (e) {
    }

    // Normalize and remove safety prefix if present
    const safetyPrefix = 'SIMULATION - TRAINING PURPOSES ONLY - THIS IS JUST FOR EDUCATIONAL/PRACTICING PURPOSES';
    let text = (simulatedEmail || '').replace(/\r\n/g, '\n').trim();
    if (text.startsWith(safetyPrefix)) text = text.slice(safetyPrefix.length).trim();

    // Regex find From: and Subject:
    const fromMatch = text.match(/^\s*From:\s*(.+)$/im);
    const subjMatch = text.match(/^\s*Subject:\s*(.+)$/im);

    let from = fromMatch ? fromMatch[1].trim() : (process.env.EMAIL_FROM || process.env.SMTP_USER);
    let subject = subjMatch ? subjMatch[1].trim() : '(No Subject)';

    // Remove those header lines from body
    let body = text;
    if (fromMatch) body = body.replace(fromMatch[0], '').trim();
    if (subjMatch) body = body.replace(subjMatch[0], '').trim();

    // fallback body
    if (!body) body = text;

    // Neutralize any links
    body = body.replace(/https?:\/\/\S+/gi, '[SIMULATED LINK]');

    return { from, subject, body };
  }

  app.post('/api/send-campaign', async (req, res) => {
    try {
      const { simulatedEmail, testOnly, linkId } = req.body || {};

      if (!simulatedEmail || typeof simulatedEmail !== 'string') {
        return res.status(400).json({ error: 'simulatedEmail (string) is required' });
      }

      const { from, subject, body } = parseSimulatedEmail(simulatedEmail);
      let finalBody = body;

      let fullShortUrl = null;

      if (finalBody.includes('[SIMULATED LINK]')) {
        if (linkId) {
          // Use the existing link
          const links = loadLinks();
          const link = links[linkId];
          if (!link) return res.status(404).json({ error: 'Provided linkId not found' });
          fullShortUrl = `http://localhost:4000/r/${link.id}`;
          finalBody = finalBody.replace(/\[SIMULATED LINK\]/g, fullShortUrl);
        } else {
          // Fallback: create a new link
          try {
            const linkRes = await fetch(`http://localhost:4000/api/links`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: "https://example.com/training",
                name: "campaign-link"
              })
            });
            const linkData = await linkRes.json();
            if (linkData.shortUrl) {
              fullShortUrl = `http://localhost:4000${linkData.shortUrl}`;
              finalBody = finalBody.replace(/\[SIMULATED LINK\]/g, fullShortUrl);
            }
          } catch (e) {
            console.error("Failed generating trackable link:", e);
          }
        }
      }

      // fetch recipient list from DB
      const sql = 'SELECT email, firstName, lastName FROM recipients';
      db.query(sql, async (err, results) => {
        if (err) {
          console.error('Failed to fetch recipients:', err);
          return res.status(500).json({ error: 'Failed to fetch recipients' });
        }

        const recipients = results.map(r => ({
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName
        })).filter(r => r.email);

        if (recipients.length === 0) return res.json({ message: 'No recipients to send to' });

        const targets = testOnly ? recipients.slice(0, 1) : recipients;

        const limit = pLimit.default ? pLimit.default(5) : pLimit(5);

        const sendOne = async (recipient) => {
          const { email, firstName, lastName } = recipient;
          const name = firstName || lastName || "Employee";

          // Replace name placeholders, but keep the same finalBody with one link
          let personalizedBody = finalBody.replace(/{{\s*employee\s*}}/gi, name);

          const mailOptions = {
            from,
            to: email,
            subject,
            text: personalizedBody,
            html: personalizedBody.replace(/\n/g, '<br/>')
          };

          return transporter.sendMail(mailOptions);
        };

        const sendPromises = targets.map(rec =>
          limit(() =>
            sendOne(rec)
              .then(info => ({ email: rec.email, success: true, info }))
              .catch(error => ({ email: rec.email, success: false, error: error?.message || String(error) }))
          )
        );

        const resultsSend = await Promise.all(sendPromises);
        const successCount = resultsSend.filter(r => r.success).length;
        const failed = resultsSend.filter(r => !r.success);

        console.log(`Campaign send complete: ${successCount}/${targets.length} succeeded`);

        return res.json({
          message: `Campaign send complete: ${successCount}/${targets.length} succeeded`,
          details: {
            total: targets.length,
            success: successCount,
            failed: failed.length,
            failedList: failed.map(f => ({ email: f.email, error: f.error }))
          }
        });
      });

    } catch (err) {
      console.error('Error in /api/send-campaign:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};