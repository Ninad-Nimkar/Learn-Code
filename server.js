/**
 * GhostScreen — server.js
 * Minimal Express backend for OpenAI code analysis.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── OpenAI Client ──
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── POST /run ──
// Predict output or error, give a short explanation.
app.post('/run', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ result: 'No code provided.' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a code execution predictor. Given source code, predict the exact output it would produce when run. If the code has errors, describe the error. Then give a one-line explanation. Format your response as:\n\nOutput:\n<predicted output or error>\n\nExplanation:\n<short explanation>',
        },
        { role: 'user', content: code },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });

    const result = completion.choices[0].message.content;
    res.json({ result });
  } catch (err) {
    console.error('Error in /run:', err.message);
    res.status(500).json({ result: 'Something went wrong.' });
  }
});

// ── POST /explain ──
// Explain the code step-by-step.
app.post('/explain', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ result: 'No code provided.' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly coding tutor. Explain the given code step-by-step in clear, concise language. Use numbered steps. Highlight key concepts. Keep it beginner-friendly.',
        },
        { role: 'user', content: code },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    const result = completion.choices[0].message.content;
    res.json({ result });
  } catch (err) {
    console.error('Error in /explain:', err.message);
    res.status(500).json({ result: 'Something went wrong.' });
  }
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`GhostScreen backend running on http://localhost:${PORT}`);
});
