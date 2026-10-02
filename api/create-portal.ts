import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
 * Create a Stripe Customer Portal session for the authenticated user.
 * Requires Authorization: Bearer <Firebase ID token>.
 * Body: { origin } — customerId is loaded from the caller's Firestore profile
 * (never accepted from the client).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not found in environment variables');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { origin } = req.body || {};
  if (!origin || typeof origin !== 'string') {
    return res.status(400).json({ error: 'Missing required field: origin' });
  }

  try {
    const url = new URL(origin);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLocal && url.protocol !== 'https:') {
      return res.status(400).json({ error: 'Invalid origin' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid origin' });
  }

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  try {
    const userSnap = await adminDb.collection('users').doc(auth.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const customerId = userSnap.data()?.stripe?.customerId;
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ error: 'No Stripe customer on this account' });
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Portal session creation failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to create portal session' });
  }
}
