import fs from 'node:fs';
import path from 'node:path';
import { cardPrompt, logSheetPrompt, CONTACT_RESPONSE_SCHEMA } from './prompts.mjs';

const MODEL = process.env.GEMINI_EVAL_MODEL || 'gemini-2.5-flash';

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * Call Gemini Vision directly (bypasses /api/gemini auth + quota).
 * Requires GEMINI_API_KEY or GOOGLE_API_KEY in the environment.
 */
export async function callGeminiVision({ imagePath, kind }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY (or GOOGLE_API_KEY) for --live mode');
  }
  const bytes = fs.readFileSync(imagePath);
  const base64 = bytes.toString('base64');
  const prompt = kind === 'log-sheet' ? logSheetPrompt() : cardPrompt();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeFor(imagePath), data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: CONTACT_RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse Gemini JSON array');
    parsed = JSON.parse(match[0]);
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
  return parsed;
}
