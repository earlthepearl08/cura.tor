import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Inline Firebase Admin init — Vercel's serverless builder reliably bundles
// firebase-admin only when imported directly inside the route file. Importing
// from a shared helper file (api/_lib or /lib) produces module-load crashes
// at runtime (FUNCTION_INVOCATION_FAILED).
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function verifyAuth(req: VercelRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    if (!token) return false;
    await getAuth().verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await verifyAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get API key from environment variable (server-side only)
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY / GOOGLE_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  try {
    const { contents, generationConfig, imageData, prompt } = req.body;

    // Flexible mode: accept raw Gemini request body (contents + generationConfig)
    if (contents) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          return res.status(response.status).json({ error: 'Gemini API request failed', details: errorData });
        } catch {
          return res.status(response.status).json({ error: 'Gemini API request failed', details: errorText });
        }
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // Legacy mode: accept imageData + prompt (backward compatible)
    if (!imageData || !prompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      try {
        const errorData = JSON.parse(errorText);
        return res.status(response.status).json({ error: 'Gemini API request failed', details: errorData });
      } catch {
        return res.status(response.status).json({ error: 'Gemini API request failed', details: errorText });
      }
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
