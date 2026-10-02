import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Sentry-ready error / observability intake.
 *
 * Accepts structured events from the client (`src/services/observability.ts`)
 * and from server handlers. Always writes a JSON log line (picked up by
 * Vercel log drains). If `SENTRY_DSN` is set, attempts a minimal Sentry
 * store envelope via fetch — no @sentry/node dependency required for the stub.
 *
 * Does not require Firebase auth (errors can happen pre-login). Rate-limit
 * lightly in-memory per IP to avoid abuse.
 */

type IntakeEvent = {
  name?: string;
  level?: string;
  message?: string;
  flow?: string;
  status?: number;
  reason?: string;
  attempt?: number;
  context?: Record<string, unknown>;
  stack?: string;
  timestamp?: string;
  source?: string;
};

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: VercelRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now >= row.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

async function forwardSentry(event: IntakeEvent): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // DSN: https://<key>@o<org>.ingest.sentry.io/<project>
  let parsed: URL;
  try {
    parsed = new URL(dsn);
  } catch {
    console.error('[api/error-log] Invalid SENTRY_DSN');
    return;
  }
  const publicKey = parsed.username;
  const projectId = parsed.pathname.replace(/^\//, '');
  if (!publicKey || !projectId) return;

  const storeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;
  const payload = {
    message: event.message || event.name || 'cura.tor event',
    level: event.level || 'error',
    platform: 'javascript',
    timestamp: Date.now() / 1000,
    tags: {
      flow: event.flow || 'unknown',
      event_name: event.name || 'custom',
      http_status: event.status != null ? String(event.status) : undefined,
      reason: event.reason,
    },
    extra: {
      context: event.context,
      attempt: event.attempt,
      source: event.source || 'cura.tor',
    },
    exception: event.stack
      ? {
          values: [
            {
              type: 'Error',
              value: event.message || 'error',
              stacktrace: { frames: [{ filename: 'client', function: event.flow || 'unknown' }] },
            },
          ],
        }
      : undefined,
  };

  try {
    const res = await fetch(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=cura.tor-error-log/0.1`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[api/error-log] Sentry forward failed', res.status, body.slice(0, 200));
    }
  } catch (err: any) {
    console.error('[api/error-log] Sentry forward error', err?.message || err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ error: 'Too many error reports' });
  }

  const body = (typeof req.body === 'string' ? safeJson(req.body) : req.body) || {};
  const event: IntakeEvent = {
    name: typeof body.name === 'string' ? body.name.slice(0, 64) : 'custom',
    level: typeof body.level === 'string' ? body.level.slice(0, 16) : 'error',
    message: typeof body.message === 'string' ? body.message.slice(0, 2000) : 'no message',
    flow: typeof body.flow === 'string' ? body.flow.slice(0, 64) : undefined,
    status: typeof body.status === 'number' ? body.status : undefined,
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 128) : undefined,
    attempt: typeof body.attempt === 'number' ? body.attempt : undefined,
    context: body.context && typeof body.context === 'object' ? sanitizeContext(body.context) : undefined,
    stack: typeof body.stack === 'string' ? body.stack.slice(0, 4000) : undefined,
    timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
    source: 'client',
  };

  // Structured log line for Vercel / drains / future BigQuery
  const isFunnelPreview =
    event.name === 'signup' ||
    event.name === 'first_scan' ||
    event.name === 'upgrade_intent' ||
    event.name === 'upgrade_success' ||
    event.level === 'info';
  console.log(
    JSON.stringify({
      src: isFunnelPreview ? 'cura.tor.api.analytics' : 'cura.tor.api.error-log',
      ip,
      ...event,
      // never echo huge context blobs twice
    })
  );

  // Alert-oriented server log for Gemini quota / upstream pain (never for funnel/info)
  const isFunnel =
    event.name === 'signup' ||
    event.name === 'first_scan' ||
    event.name === 'upgrade_intent' ||
    event.name === 'upgrade_success' ||
    event.level === 'info';

  if (!isFunnel) {
    if (event.name === 'gemini_429' || event.status === 429) {
      console.warn('[alert] gemini_429', event.flow, event.reason, event.message);
    }
    if (event.name === 'gemini_5xx' || (event.status != null && event.status >= 500)) {
      console.warn('[alert] gemini_5xx', event.status, event.flow, event.message);
    }
    if (event.name === 'scan_failure') {
      console.warn('[alert] scan_failure', event.flow, event.message);
    }
  }

  // Forward errors/warns to Sentry when DSN set; skip pure funnel noise
  if (!isFunnel || event.level === 'error' || event.level === 'warn') {
    void forwardSentry(event);
  }

  return res.status(202).json({ ok: true });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx).slice(0, 20)) {
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (typeof v === 'number' || typeof v === 'boolean' || v == null) out[k] = v;
    else out[k] = String(v).slice(0, 200);
  }
  return out;
}
