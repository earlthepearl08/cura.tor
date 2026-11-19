import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, checkRateLimit, checkAndIncrementQuota, refundScan } from './_lib/scanGuards.js';
import { sanitizeGeminiRequest } from './_lib/geminiRequest.js';

// Ops (billing / 429 / cost): see GEMINI_OPS.md — no in-app health dashboard.
// Grep Vercel logs for: "Gemini API error:", "[api/gemini]", "quota-exceeded", "rate-limit-".
// Shared auth/rate/quota: api/_lib/scanGuards.ts (relative import — see api/_lib/README.md).

/** Structured upstream error line for log drains / MONITORING.md alerts. */
function logGeminiUpstreamError(status: number, errorText: string, mode: string) {
  const name = status === 429 ? 'gemini_429' : status >= 500 ? 'gemini_5xx' : 'gemini_upstream_error';
  console.warn(
    JSON.stringify({
      src: 'cura.tor.api.gemini',
      name,
      level: 'error',
      status,
      mode,
      message: String(errorText || '').slice(0, 500),
      timestamp: new Date().toISOString(),
    })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  }

  // Rate limit (abuse ceiling)
  try {
    const rl = await checkRateLimit(auth.uid);
    if (!rl.ok) {
      console.warn(JSON.stringify({
        src: 'cura.tor.api.gemini',
        name: 'gemini_429',
        level: 'warn',
        reason: `rate-limit-${rl.window}`,
        uid: auth.uid,
        resetInMs: rl.resetIn,
        timestamp: new Date().toISOString(),
      }));
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
    console.error('[api/gemini] Rate limit check failed:', errName, errCode, errMsg, errStack);
    return res.status(500).json({
      error: 'Rate limit check failed',
      details: `${errName}${errCode}: ${errMsg}`,
    });
  }

  // Tier quota enforcement + atomic scan count increment
  let quota: Awaited<ReturnType<typeof checkAndIncrementQuota>>;
  try {
    quota = await checkAndIncrementQuota(auth.uid);
    if (!quota.ok) {
      if (quota.reason === 'quota-exceeded') {
        console.warn(JSON.stringify({
          src: 'cura.tor.api.gemini',
          name: 'gemini_429',
          level: 'warn',
          reason: 'quota-exceeded',
          tier: quota.tier,
          uid: auth.uid,
          timestamp: new Date().toISOString(),
        }));
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
    console.error('[api/gemini] Quota check failed:', errName, errCode, errMsg, errStack);
    return res.status(500).json({
      error: 'Quota check failed',
      details: `${errName}${errCode}: ${errMsg}`,
    });
  }

  const chargedPeriod = quota!.ok ? quota!.periodStartMs : undefined;

  // Get API key from environment variable (server-side only)
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY / GOOGLE_API_KEY not found in environment variables');
    await refundScan(auth.uid, chargedPeriod);
    return res.status(500).json({ error: 'API key not configured.' });
  }

  // From here on a scan has been reserved; give it back on any failure so
  // transient Google errors (which the client retries) don't burn quota.
  try {
    const { contents, generationConfig, imageData, prompt } = req.body || {};

    let upstreamBody: unknown;
    let mode: string;
    if (contents) {
      const sanitized = sanitizeGeminiRequest({ contents, generationConfig });
      if (!sanitized.ok) {
        await refundScan(auth.uid, chargedPeriod);
        return res.status(400).json({ error: 'Invalid request', reason: sanitized.error });
      }
      upstreamBody = sanitized.body;
      mode = 'contents';
    } else {
      // Legacy mode: imageData + prompt. Routed through the same allowlist.
      if (typeof imageData !== 'string' || typeof prompt !== 'string') {
        await refundScan(auth.uid, chargedPeriod);
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const sanitized = sanitizeGeminiRequest({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageData.replace(/^data:image\/\w+;base64,/, '') } },
          ],
        }],
        generationConfig: { temperature: 0.1, topK: 32, topP: 1, maxOutputTokens: 2048 },
      });
      if (!sanitized.ok) {
        await refundScan(auth.uid, chargedPeriod);
        return res.status(400).json({ error: 'Invalid request', reason: sanitized.error });
      }
      upstreamBody = sanitized.body;
      mode = 'legacy';
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upstreamBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      logGeminiUpstreamError(response.status, errorText, mode);
      await refundScan(auth.uid, chargedPeriod);
      try {
        const errorData = JSON.parse(errorText);
        return res.status(response.status).json({ error: 'Gemini API request failed', details: errorData });
      } catch {
        return res.status(response.status).json({ error: 'Gemini API request failed', details: errorText });
      }
    }

    const data = await response.json();
    // 200 with no text: refund only when Google billed no output (prompt
    // blocked / zero output+thinking tokens). A MAX_TOKENS response that burned
    // thinking tokens is still charged, otherwise a crafted prompt could make
    // unlimited billed calls on the owner's key without ever using quota.
    const usage = data?.usageMetadata || {};
    const billedOutput = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
    const noText = !data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (noText && (data?.promptFeedback?.blockReason || billedOutput === 0)) {
      logGeminiUpstreamError(200, JSON.stringify(data?.promptFeedback || data?.candidates?.[0]?.finishReason || 'empty'), `${mode}-empty`);
      await refundScan(auth.uid, chargedPeriod);
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    await refundScan(auth.uid, chargedPeriod);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
