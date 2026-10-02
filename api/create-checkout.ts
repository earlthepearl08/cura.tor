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

type PaidTier = 'early_access' | 'pro';

/** Resolve tier from an allowlisted price ID (never trust client-supplied tier) */
function getTierFromPriceId(priceId: string): PaidTier | null {
  const pioneerPrices = (process.env.STRIPE_PIONEER_PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const proPrices = (process.env.STRIPE_PRO_PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  // Fallback: also accept the Vite client price IDs if server lists aren't set yet
  const clientPioneer = [
    process.env.VITE_STRIPE_PIONEER_MONTHLY_PRICE_ID,
    process.env.VITE_STRIPE_PIONEER_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];
  const clientPro = [
    process.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID,
  ].filter(Boolean) as string[];

  if (pioneerPrices.includes(priceId) || clientPioneer.includes(priceId)) return 'early_access';
  if (proPrices.includes(priceId) || clientPro.includes(priceId)) return 'pro';
  return null;
}

function eventPackPriceIds(): string[] {
  const server = (process.env.STRIPE_EVENT_PACK_PRICE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const client = process.env.VITE_STRIPE_EVENT_PACK_PRICE_ID?.trim();
  const ids = [...server];
  if (client && !ids.includes(client)) ids.push(client);
  return ids;
}

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return isLocal || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Create a Stripe Checkout session for the authenticated user.
 * Requires Authorization: Bearer <Firebase ID token>.
 *
 * Body:
 * - { priceId, origin } — Pioneer/Pro subscription (tier from allowlisted price)
 * - { product: 'event_pack', priceId, origin } — one-time Event pack (mode=payment)
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

  const { priceId, origin, product } = req.body || {};
  if (!priceId || !origin || typeof priceId !== 'string' || typeof origin !== 'string') {
    return res.status(400).json({ error: 'Missing required fields: priceId, origin' });
  }

  if (!isValidOrigin(origin)) {
    return res.status(400).json({ error: 'Invalid origin' });
  }

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  // --- One-time Event pack ---
  if (product === 'event_pack') {
    const allowed = eventPackPriceIds();
    if (allowed.length === 0) {
      return res.status(500).json({
        error: 'Event pack price not configured (set VITE_STRIPE_EVENT_PACK_PRICE_ID / STRIPE_EVENT_PACK_PRICE_IDS)',
      });
    }
    if (!allowed.includes(priceId)) {
      return res.status(400).json({ error: 'Unrecognized Event pack priceId' });
    }

    try {
      const userSnap = await adminDb.collection('users').doc(auth.uid).get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      const userData = userSnap.data()!;
      const email = auth.email || userData.email;
      if (!email) {
        return res.status(400).json({ error: 'User email required for checkout' });
      }

      const existingCustomerId =
        typeof userData.stripe?.customerId === 'string' && userData.stripe.customerId
          ? userData.stripe.customerId
          : undefined;

      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        ...(existingCustomerId
          ? { customer: existingCustomerId }
          : { customer_email: email }),
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: auth.uid,
        metadata: { firebaseUid: auth.uid, product: 'event_pack' },
        success_url: `${origin}/events?payment=success`,
        cancel_url: `${origin}/events?payment=canceled`,
      });

      return res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error('Event pack checkout failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to create Event pack checkout' });
    }
  }

  // --- Pioneer / Pro subscription ---
  const tier = getTierFromPriceId(priceId);
  if (!tier) {
    return res.status(400).json({ error: 'Unrecognized priceId' });
  }

  try {
    const userSnap = await adminDb.collection('users').doc(auth.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const userData = userSnap.data()!;
    const email = auth.email || userData.email;
    if (!email) {
      return res.status(400).json({ error: 'User email required for checkout' });
    }

    // Enterprise seats are provisioned outside Stripe
    if (userData.tier === 'enterprise') {
      return res.status(400).json({ error: 'Enterprise accounts are managed separately' });
    }

    const existingCustomerId =
      typeof userData.stripe?.customerId === 'string' && userData.stripe.customerId
        ? userData.stripe.customerId
        : undefined;

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: email }),
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: auth.uid,
      metadata: { firebaseUid: auth.uid, tier },
      subscription_data: {
        metadata: { firebaseUid: auth.uid, tier },
      },
      success_url: `${origin}/settings?payment=success`,
      cancel_url: `${origin}/settings?payment=canceled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session creation failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
