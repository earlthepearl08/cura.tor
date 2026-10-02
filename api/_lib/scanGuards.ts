/**
 * Shared auth + rate-limit + tier-quota helpers for scan APIs.
 *
 * Import only via relative path from api/*.ts handlers (see ./README.md).
 * Do not import firebase-admin/auth — it does not bundle on this Vercel project.
 */
import type { VercelRequest } from '@vercel/node';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/**
 * Lazily initialize Firebase Admin and return Firestore instance.
 * Trims env vars because past incidents involved trailing newlines from
 * `vercel env add` silently corrupting values. Private key is unescaped
 * first (Vercel stores literal backslash-n) then trimmed.
 */
export function getAdminDb() {
  if (!getApps().length) {
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = privateKeyRaw?.replace(/\\n/g, '\n').trim();
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID env var missing or empty');
    if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL env var missing or empty');
    if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY env var missing or empty');
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY env var does not look like a PEM key (missing BEGIN PRIVATE KEY marker)');
    }
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } catch (err: any) {
      throw new Error(`Firebase Admin initializeApp failed: ${err?.message || err}`);
    }
  }
  return getFirestore();
}

export type AuthOk = { ok: true; uid: string; email: string | null };
export type AuthFail = { ok: false; reason: string };

/** Verify Firebase ID token via Google JWKS (not firebase-admin/auth). */
export async function verifyAuth(req: VercelRequest): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { ok: false, reason: 'no-header' };
  if (!authHeader.startsWith('Bearer ')) return { ok: false, reason: 'wrong-scheme' };
  const token = authHeader.slice(7);
  if (!token) return { ok: false, reason: 'empty-token' };
  if (!FIREBASE_PROJECT_ID) return { ok: false, reason: 'server-missing-project-id' };
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) return { ok: false, reason: 'missing-sub' };
    const email = typeof (payload as any).email === 'string' ? (payload as any).email : null;
    return { ok: true, uid, email };
  } catch (err: any) {
    return { ok: false, reason: `jwt-${err?.code || err?.message || 'unknown'}` };
  }
}

// --- Rate limiting (abuse ceiling, applies to all tiers) ---
// Generous numbers — calibrated so a legitimate trade-show power user never
// hits these. The point is to catch stolen tokens, infinite-loop bugs, and
// scripted abuse, not to gate normal usage.
const RATE_LIMIT_MINUTE = 60;
const RATE_LIMIT_HOUR = 600;
const RATE_LIMIT_DAY = 3000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; window: 'minute' | 'hour' | 'day'; resetIn: number };

export async function checkRateLimit(uid: string): Promise<RateLimitResult> {
  const db = getAdminDb();
  const ref = db.collection('rateLimits').doc(uid);
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60_000);
  const hourBucket = Math.floor(now / 3_600_000);
  const dayBucket = Math.floor(now / 86_400_000);

  return await db.runTransaction(async (tx): Promise<RateLimitResult> => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};

    const minuteCount = data.minuteBucket === minuteBucket ? (data.minuteCount || 0) : 0;
    const hourCount = data.hourBucket === hourBucket ? (data.hourCount || 0) : 0;
    const dayCount = data.dayBucket === dayBucket ? (data.dayCount || 0) : 0;

    if (minuteCount >= RATE_LIMIT_MINUTE) {
      return { ok: false, window: 'minute', resetIn: 60_000 - (now % 60_000) };
    }
    if (hourCount >= RATE_LIMIT_HOUR) {
      return { ok: false, window: 'hour', resetIn: 3_600_000 - (now % 3_600_000) };
    }
    if (dayCount >= RATE_LIMIT_DAY) {
      return { ok: false, window: 'day', resetIn: 86_400_000 - (now % 86_400_000) };
    }

    tx.set(ref, {
      minuteBucket,
      minuteCount: minuteCount + 1,
      hourBucket,
      hourCount: hourCount + 1,
      dayBucket,
      dayCount: dayCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { ok: true };
  });
}

// --- Tier quota enforcement (mirrors src/services/userService.ts) ---
export type QuotaResult =
  | { ok: true; tier: string }
  | { ok: false; reason: 'quota-exceeded' | 'user-not-found' | 'tier-unknown'; tier?: string };

/** Get the next monthly reset date: same day-of-month as periodStart, one month later */
function getNextResetDate(periodStartMs: number): number {
  const d = new Date(periodStartMs);
  const targetDay = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDayOfMonth));
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

const FREE_SCANS_PER_MONTH = 5;

export async function checkAndIncrementQuota(uid: string): Promise<QuotaResult> {
  const db = getAdminDb();
  const ref = db.collection('users').doc(uid);

  return await db.runTransaction(async (tx): Promise<QuotaResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'user-not-found' };

    const data = snap.data() || {};
    const tier: string = data.tier || 'free';
    const scanUsage = data.scanUsage || {};
    const count: number = scanUsage.count || 0;
    const lifetimeCount: number = scanUsage.lifetimeCount || 0;
    const lifetimeLimit: number | null = scanUsage.lifetimeLimit ?? null;

    // periodStart can be a Firestore Timestamp or a millis number
    let periodStartMs: number = Date.now();
    if (scanUsage.periodStart) {
      if (typeof scanUsage.periodStart === 'number') {
        periodStartMs = scanUsage.periodStart;
      } else if (typeof scanUsage.periodStart.toMillis === 'function') {
        periodStartMs = scanUsage.periodStart.toMillis();
      }
    }

    // Pro and enterprise: always allowed, increment lifetime
    if (tier === 'pro' || tier === 'enterprise') {
      tx.update(ref, {
        'scanUsage.count': FieldValue.increment(1),
        'scanUsage.lifetimeCount': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, tier };
    }

    // Free: monthly cap, reset if past period
    if (tier === 'free') {
      const now = Date.now();
      const nextReset = getNextResetDate(periodStartMs);
      const effectiveCount = now >= nextReset ? 0 : count;

      if (effectiveCount + 1 > FREE_SCANS_PER_MONTH) {
        return { ok: false, reason: 'quota-exceeded', tier };
      }

      if (now >= nextReset) {
        tx.update(ref, {
          'scanUsage.count': 1,
          'scanUsage.periodStart': FieldValue.serverTimestamp(),
          'scanUsage.lifetimeCount': FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          'scanUsage.count': FieldValue.increment(1),
          'scanUsage.lifetimeCount': FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { ok: true, tier };
    }

    // Early access: lifetime cap, no monthly reset
    if (tier === 'early_access') {
      if (lifetimeLimit !== null && lifetimeCount + 1 > lifetimeLimit) {
        return { ok: false, reason: 'quota-exceeded', tier };
      }
      tx.update(ref, {
        'scanUsage.count': FieldValue.increment(1),
        'scanUsage.lifetimeCount': FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, tier };
    }

    return { ok: false, reason: 'tier-unknown', tier };
  });
}
