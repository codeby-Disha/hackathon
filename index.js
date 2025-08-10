import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// API endpoint for AI Summary
app.post("/ai-summary", async (req, res) => {
  try {
    const { settlements } = req.body;
    if (!settlements || settlements.trim() === "") {
      return res.status(400).json({ error: "No settlements provided" });
    }

    const prompt = `Summarize this expense settlement in simple friendly language:\n${settlements}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }]
    });

    const summary = completion.choices[0].message.content.trim();
    res.json({ summary });
  } catch (err) {
    console.error("AI Summary Error:", err);
    res.status(500).json({ error: "Failed to get AI summary" });
  }
});

app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
