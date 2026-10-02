import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, checkRateLimit, checkAndIncrementQuota } from './_lib/scanGuards';

// Ops (billing / 429 / cost): see GEMINI_OPS.md — no in-app health dashboard.
// Grep Vercel logs for: "Cloud Vision API error:", "[api/ocr]", "quota-exceeded", "rate-limit-".
// Shared auth/rate/quota: api/_lib/scanGuards.ts (relative import — see api/_lib/README.md).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  }

  // Rate limit (abuse ceiling) — fast first because it's a single doc read
  try {
    const rl = await checkRateLimit(auth.uid);
    if (!rl.ok) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        reason: `rate-limit-${rl.window}`,
        resetInMs: rl.resetIn,
      });
    }
  } catch (err: any) {
    const errName = err?.name || 'Error';
    const errCode = err?.code ? `[${err.code}]` : '';
    const errMsg = err?.message || String(err);
    const errStack = err?.stack?.split('\n').slice(0, 3).join(' | ') || '';
    console.error('[api/ocr] Rate limit check failed:', errName, errCode, errMsg, errStack);
    return res.status(500).json({
      error: 'Rate limit check failed',
      details: `${errName}${errCode}: ${errMsg}`,
    });
  }

  // Tier quota enforcement + atomic scan count increment
  try {
    const quota = await checkAndIncrementQuota(auth.uid);
    if (!quota.ok) {
      if (quota.reason === 'quota-exceeded') {
        return res.status(429).json({
          error: 'Scan limit reached for your tier',
          reason: 'quota-exceeded',
          tier: quota.tier,
        });
      }
      return res.status(403).json({ error: 'Quota check failed', reason: quota.reason });
    }
  } catch (err: any) {
    const errName = err?.name || 'Error';
    const errCode = err?.code ? `[${err.code}]` : '';
    const errMsg = err?.message || String(err);
    const errStack = err?.stack?.split('\n').slice(0, 3).join(' | ') || '';
    console.error('[api/ocr] Quota check failed:', errName, errCode, errMsg, errStack);
    return res.status(500).json({
      error: 'Quota check failed',
      details: `${errName}${errCode}: ${errMsg}`,
    });
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
