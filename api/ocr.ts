import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Inline Firebase Admin init using the namespace import — the modular subpath
// `firebase-admin/auth` does not bundle correctly on this Vercel project and
// produces FUNCTION_INVOCATION_FAILED at module load. The main package entry
// works (see api/stripe-webhook.ts), so we go through `admin.auth()` instead
// of `getAuth()`.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
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
    await admin.auth().verifyIdToken(token);
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

  // Get API key from environment variable (server-side only, no VITE_ prefix)
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_API_KEY / GEMINI_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured.' });
  }

  try {
    const { imageData, languageHints } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Missing imageData' });
    }

    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Call Cloud Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: {
              languageHints: languageHints || ['en', 'tl', 'zh', 'ja', 'ko']
            }
          }]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloud Vision API error:', response.status, errorText);
      try {
        const errorData = JSON.parse(errorText);
        return res.status(response.status).json({ error: 'Cloud Vision API request failed', details: errorData });
      } catch {
        return res.status(response.status).json({ error: 'Cloud Vision API request failed', details: errorText });
      }
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
