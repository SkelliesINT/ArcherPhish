// backend/aiGenerate.js

module.exports = function registerAIGenerateRoute(app) {
  if (!app) throw new Error("Express 'app' instance required");

  app.post('/api/generate', async (req, res) => {
    try {
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) {
        console.error('OPENAI_API_KEY is not set in environment.');
        return res.status(500).send('Server configuration error');
      }

      const { prompt = '', role = 'generic', difficulty = 'low' } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Safety / system prompt (produces only simulated email body)
      const systemPrompt = `You are a generator of CLEARLY LABELED SIMULATED TRAINING EMAILS for phishing-awareness practice.
        Important constraints:
        - Do NOT provide real malicious instructions, credential-harvesting steps, or actionable payloads.
        - Produce ONLY a single simulated email body (subject + from + body), appropriate to the provided role and difficulty.
        - Do not append analysis, red-flag lists, quizzes, or instructions. Return only the simulated email content.
        - Tone and wording should vary by role/difficulty but remain non-actionable.`;

      // Map difficulty to an explicit instruction so the model knows how subtle/obvious to be
      const diff = String(difficulty || 'low').toLowerCase();
      let difficultyInstruction;
      if (diff === 'low') {
        difficultyInstruction = 'Difficulty instruction: LOW — make the language obvious and include clear, easy-to-spot suspicious cues (generic greeting, poor grammar, explicit urgency).';
      } else if (diff === 'medium') {
        difficultyInstruction = 'Difficulty instruction: MEDIUM — make the language realistic but still detectable by attentive users (plausible sender, moderate urgency, slightly polished wording).';
      } else if (diff === 'high') {
        difficultyInstruction = 'Difficulty instruction: HIGH — make wording more sophisticated and targeted (personalized details, professional tone) while remaining non-actionable and clearly labeled as a simulation.';
      } else {
        difficultyInstruction = `Difficulty instruction: ${diff.toUpperCase()} — use moderate sophistication.`;
      }

      // Build the user message including difficultyInstruction
      const userMessage = [
        `Scenario prompt: ${prompt.trim()}`,
        `Role: ${role}`,
        difficultyInstruction,
        'Instruction: Return only the simulated email (Subject, From, Body). This is for internal training. Do NOT include red flags, quizzes, or external analysis.'
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
          temperature: 0.7,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('OpenAI API error:', errText);
        return res.status(502).json({ error: 'OpenAI API error' });
      }

      const data = await openaiRes.json();
      let generated =
        (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

      generated = generated.trim();

      // Enforce safety prefix server-side (commented out for now)
      const safetyPrefix = 'SIMULATION - TRAINING PURPOSES ONLY - THIS IS JUST FOR EDUCATIONAL/PRACTICING PURPOSES';
      if (!generated.startsWith('SIMULATION - TRAINING PURPOSES ONLY')) {
        generated = `${safetyPrefix}\n\n${generated}`;
      }

      // Replace any raw links with a simulated placeholder to avoid accidental clicks
      generated = generated.replace(/https?:\/\/\S+/gi, '[SIMULATED LINK]');

      // Return the simulated email string
      return res.json({ simulatedEmail: generated });
    } catch (err) {
      console.error('Error in /api/generate:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
};