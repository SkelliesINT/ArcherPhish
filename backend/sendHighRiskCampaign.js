// backend/sendHighRiskCampaign.js
// POST /api/send-campaign-highRisk
// Generates a personalized AI email for each selected high-risk recipient using
// OSINT placeholder substitution — no real PII is sent to the AI API.
const nodemailer = require('nodemailer');
const pLimit = require('p-limit');
const crypto = require('crypto');

module.exports = function registerSendHighRiskCampaignRoute(app, db) {
  if (!app) throw new Error('Express app required');
  if (!db) throw new Error('Database connection required');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE === 'true') || false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  // Calls OpenAI with placeholder tokens — real PII never leaves the server
  async function generatePersonalizedEmail(recipient, role, difficulty) {
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');

    const osint = recipient.osintData || {};

    const systemPrompt = `You are a generator of CLEARLY LABELED SIMULATED TRAINING EMAILS for phishing-awareness practice.
Important constraints:
- Do NOT provide real malicious instructions, credential-harvesting steps, or actionable payloads.
- Produce ONLY a single simulated email with From:, Subject:, and body.
- Do not append analysis, red-flag lists, quizzes, or instructions.
- Use the provided recipient profile context to craft a convincing but labeled simulation.
- Where you want the recipient's full name, use the token {{FULL_NAME}}.
- Where a link should appear, use [SIMULATED LINK].`;

    const diff = String(difficulty || 'high').toLowerCase();
    let difficultyInstruction;
    if (diff === 'low') {
      difficultyInstruction = 'Difficulty: LOW — obvious cues, generic greeting, poor grammar, explicit urgency.';
    } else if (diff === 'medium') {
      difficultyInstruction = 'Difficulty: MEDIUM — realistic but detectable, plausible sender, moderate urgency.';
    } else {
      difficultyInstruction = 'Difficulty: HIGH — sophisticated, professional tone, highly targeted. Weave the provided profile details naturally into the email body.';
    }

    // Build profile from placeholder descriptions — no real PII in prompt
    const profileParts = [
      recipient.jobTitle   ? `Job Title: ${recipient.jobTitle}`         : null,
      recipient.department ? `Department: ${recipient.department}`       : null,
      osint.location       ? `Location: ${osint.location}`               : null,
      osint.manager        ? `Manager / Reports To: ${osint.manager}`    : null,
      osint.interests      ? `Personal Interests: ${osint.interests}`    : null,
      osint.projects       ? `Key Projects: ${osint.projects}`           : null,
      osint.notes          ? `Additional Context: ${osint.notes}`        : null,
    ].filter(Boolean);

    const profileSection = profileParts.length > 0
      ? profileParts.join('\n')
      : 'No additional profile details available.';

    const userMessage = [
      `Generate a personalized phishing simulation email for a recipient with the following profile.`,
      `Recipient Profile:\n${profileSection}`,
      `Email Style / Role: ${role}`,
      difficultyInstruction,
      `Use {{FULL_NAME}} where the recipient's name should appear. Use [SIMULATED LINK] for any link.`,
      `Return only: From:, Subject:, and email body. Nothing else. Do not include any simulation label or disclaimer.`,
    ].join('\n\n');

    const modelToUse = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 700,
        temperature: 0.8,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const data = await openaiRes.json();
    let generated = (data.choices?.[0]?.message?.content || '').trim();

    // Strip any real URLs that slipped through
    generated = generated.replace(/https?:\/\/\S+/gi, '[SIMULATED LINK]');

    return generated;
  }

  function parseEmailText(text) {
    const fromMatch = text.match(/^\s*From:\s*(.+)$/im);
    const subjMatch = text.match(/^\s*Subject:\s*(.+)$/im);
    const from = fromMatch ? fromMatch[1].trim() : (process.env.EMAIL_FROM || process.env.SMTP_USER);
    const subject = subjMatch ? subjMatch[1].trim() : '(No Subject)';
    let body = text;
    if (fromMatch) body = body.replace(fromMatch[0], '').trim();
    if (subjMatch) body = body.replace(subjMatch[0], '').trim();
    return { from, subject, body: body || text };
  }

  app.post('/api/send-campaign-highRisk', async (req, res) => {
    try {
      const { recipientIds, role, difficulty } = req.body || {};

      if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: 'recipientIds (non-empty array) is required' });
      }

      // Fetch only high-risk recipients from the provided IDs
      const placeholders = recipientIds.map(() => '?').join(', ');
      const [rows] = await db.query(
        `SELECT id, first_name AS firstName, last_name AS lastName, email,
                department, job_title AS jobTitle, osint_data AS osintData
         FROM recipients
         WHERE id IN (${placeholders}) AND high_risk = 1 AND email IS NOT NULL AND email != ''`,
        recipientIds
      );

      if (rows.length === 0) {
        return res.json({ message: 'No valid high-risk recipients found in the provided IDs' });
      }

      const recipients = rows.map(r => ({
        ...r,
        osintData: r.osintData ? JSON.parse(r.osintData) : {},
      }));

      // Create campaign record
      const campaignName = `High-Risk Intensive (${new Date().toLocaleDateString()})`;
      const [campaignResult] = await db.query(
        'INSERT INTO campaigns (name, difficulty) VALUES (?, ?)',
        [campaignName, difficulty || 'high']
      );
      const campaignId = campaignResult.insertId;

      // Create phishing_links per recipient
      const recipientTrackingMap = {};
      for (const rec of recipients) {
        const trackingId = crypto.randomBytes(24).toString('hex');
        try {
          await db.query(
            'INSERT INTO phishing_links (campaign_id, recipient_id, tracking_id) VALUES (?, ?, ?)',
            [campaignId, rec.id, trackingId]
          );
          recipientTrackingMap[rec.id] = trackingId;
        } catch (e) {
          console.error(`Failed to create phishing link for recipient ${rec.id}:`, e.message);
        }
      }

      // Limit concurrent AI calls to avoid rate limiting
      const limit = pLimit.default ? pLimit.default(2) : pLimit(2);

      const sendOne = async (recipient) => {
        const { id, email, firstName, lastName } = recipient;
        const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Employee';
        const trackingId = recipientTrackingMap[id];
        const trackingUrl = trackingId
          ? `${process.env.BASE_URL || 'http://localhost:4000'}/r/${trackingId}`
          : null;

        const emailText = await generatePersonalizedEmail(recipient, role || 'spear_phish', difficulty || 'high');
        const { from, subject, body } = parseEmailText(emailText);

        // Substitute placeholder tokens with real recipient values
        const personalizedBody = body
          .replace(/\{\{\s*FULL_NAME\s*\}\}/gi, fullName)
          .replace(/\{\{\s*employee\s*\}\}/gi, firstName || fullName)
          .replace(/\[SIMULATED LINK\]/g, trackingUrl || '[LINK]');

        return transporter.sendMail({
          from,
          to: email,
          subject,
          text: personalizedBody,
          html: personalizedBody.replace(/\n/g, '<br/>'),
        });
      };

      const sendPromises = recipients.map(rec =>
        limit(() =>
          sendOne(rec)
            .then(info => ({ email: rec.email, name: `${rec.firstName || ''} ${rec.lastName || ''}`.trim(), success: true, info }))
            .catch(error => ({ email: rec.email, name: `${rec.firstName || ''} ${rec.lastName || ''}`.trim(), success: false, error: error?.message || String(error) }))
        )
      );

      const results = await Promise.all(sendPromises);
      const successCount = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);

      console.log(`High-Risk campaign send complete: ${successCount}/${recipients.length} succeeded. Campaign ID: ${campaignId}`);

      return res.json({
        message: `High-Risk campaign sent: ${successCount}/${recipients.length} succeeded`,
        campaignId,
        details: {
          total: recipients.length,
          success: successCount,
          failed: failed.length,
          failedList: failed.map(f => ({ email: f.email, name: f.name, error: f.error })),
        },
      });

    } catch (err) {
      console.error('Error in /api/send-campaign-highRisk:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};
