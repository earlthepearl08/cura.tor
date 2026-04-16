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

function isOwnerEmail(email: string | null): boolean {
  if (!email) return false;
  const owners = (process.env.OWNER_EMAILS || 'earldy.kinmo@gmail.com')
    .split(',').map(e => e.trim().toLowerCase());
  return owners.includes(email.toLowerCase());
}

/**
 * Owner-only endpoint to grant a time-bounded trial of pro/pioneer to a user.
 * Body: { targetUid, tier: 'early_access'|'pro', scanLimit, contactLimit, expiresAt }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  if (!isOwnerEmail(auth.email)) return res.status(403).json({ error: 'Owner access required' });

  const { targetUid, tier, scanLimit, contactLimit, expiresAt } = req.body || {};
  if (!targetUid || typeof targetUid !== 'string') {
    return res.status(400).json({ error: 'Missing targetUid' });
  }
  if (tier !== 'early_access' && tier !== 'pro') {
    return res.status(400).json({ error: 'tier must be early_access or pro' });
  }
  if (scanLimit !== null && (typeof scanLimit !== 'number' || scanLimit < 1)) {
    return res.status(400).json({ error: 'scanLimit must be a positive number or null for unlimited' });
  }
  if (contactLimit !== null && (typeof contactLimit !== 'number' || contactLimit < 1)) {
    return res.status(400).json({ error: 'contactLimit must be a positive number or null for unlimited' });
  }
  if (!expiresAt || typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
    return res.status(400).json({ error: 'expiresAt must be a future timestamp (ms)' });
  }

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  try {
    const userRef = adminDb.collection('users').doc(targetUid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Target user not found. They must sign in at least once first.' });
    }

    await userRef.update({
      tier,
      'scanUsage.lifetimeLimit': scanLimit,
      contactLimit,
      expiresAt,
      trialSourceTier: tier,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, targetUid, tier, expiresAt });
  } catch (err: any) {
    console.error('Grant trial error:', err);
    return res.status(500).json({ error: err.message || 'Failed to grant trial' });
  }
}
