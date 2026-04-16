import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function getAdminDb() {
  if (!getApps().length) {
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = privateKeyRaw?.replace(/\\n/g, '\n').trim();
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID env var missing or empty');
    if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL env var missing or empty');
    if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY env var missing or empty');
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY does not look like a PEM key');
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

type AuthOk = { ok: true; uid: string; email: string | null };
type AuthFail = { ok: false; reason: string };

async function verifyAuth(req: VercelRequest): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'no-bearer' };
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

/**
 * Downgrades the caller to 'free' if their trial has expired.
 * Returns { downgraded: boolean, previousTier?: string }.
 * Safe to call on every sign-in — no-op if not expired.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  try {
    const userRef = adminDb.collection('users').doc(auth.uid);
    const snap = await userRef.get();
    if (!snap.exists) return res.status(200).json({ downgraded: false });

    const data = snap.data()!;
    const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt
                    : data.expiresAt?.toMillis?.() ?? null;

    // Not expired, or no expiry set: nothing to do
    if (!expiresAt || Date.now() < expiresAt) {
      return res.status(200).json({ downgraded: false });
    }

    // Enterprise users never auto-downgrade here — they have an org attached.
    if (data.tier === 'enterprise') {
      return res.status(200).json({ downgraded: false });
    }

    const previousTier = data.tier;

    await userRef.update({
      tier: 'free',
      contactLimit: 25, // TIER_LIMITS.free.contactStorage
      'scanUsage.lifetimeLimit': null,
      'scanUsage.count': 0,
      'scanUsage.periodStart': FieldValue.serverTimestamp(),
      expiresAt: null,
      trialSourceTier: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ downgraded: true, previousTier });
  } catch (err: any) {
    console.error('Check expiry error:', err);
    return res.status(500).json({ error: err.message || 'Failed to check expiry' });
  }
}
