// index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors()); // allow your frontend (localhost) to call this
app.use(express.json({ limit: '1mb' }));

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /summary
 * body: { settlements: string, expenses: array }
 */
app.post('/summary', async (req, res) => {
  try {
    const { settlements = 'No settlement computed yet.', expenses = [] } = req.body;

    // Build a concise prompt that asks the model to summarize settlements and optionally list insights.
    const prompt = `
You are a helpful assistant that summarizes expense settlements.

SETTLEMENTS:
${settlements}

EXPENSES (JSON):
${JSON.stringify(expenses, null, 2)}

Please return:
1. A 2-3 sentence plain-language summary of who pays whom and the total money moved.
2. A short bullet list (max 4 bullets) with helpful insights (e.g., who paid most, if there's imbalance, suggestions).
Return JSON with keys: "summary" (string) and "insights" (array of strings).
`;

    // Call OpenAI Chat Completions / Responses via official SDK (choose a modern model)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',      // change if you want another model
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    });

    // extract text — follow typical response shape
    const text = response.choices?.[0]?.message?.content ?? '';

    // Try to parse JSON if model returned JSON; otherwise return text in `summary`.
    let result = { summary: text, insights: [] };
    try {
      const parsed = JSON.parse(text);
      result.summary = parsed.summary ?? JSON.stringify(parsed);
      result.insights = parsed.insights ?? [];
    } catch (e) {
      // not JSON — keep raw text in summary
    }

    res.json(result);
  } catch (err) {
    console.error('AI request failed', err);
    res.status(500).json({ error: 'AI request failed', details: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
