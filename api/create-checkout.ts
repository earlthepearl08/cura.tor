import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

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
 * Stripe Checkout.
 * - Default / legacy body: subscription (Pioneer/Pro) — unchanged fields for Settings.
 * - { product: 'event_pack', priceId, origin } + Bearer token: one-time Event pack.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY not found in environment variables');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeSecretKey);
  const body = req.body || {};
  const product = body.product;

  // --- One-time Event pack ---
  if (product === 'event_pack') {
    const auth = await verifyAuth(req);
    if (!auth.ok) {
      return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
    }

    const { priceId, origin } = body;
    if (!priceId || !origin || typeof priceId !== 'string' || typeof origin !== 'string') {
      return res.status(400).json({ error: 'Missing required fields: priceId, origin' });
    }
    if (!isValidOrigin(origin)) {
      return res.status(400).json({ error: 'Invalid origin' });
    }

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
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: auth.email || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: auth.uid,
        metadata: {
          firebaseUid: auth.uid,
          product: 'event_pack',
        },
        success_url: `${origin}/events?payment=success`,
        cancel_url: `${origin}/events?payment=canceled`,
      });

      return res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error('Event pack checkout failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
    }
  }

  // --- Legacy subscription checkout (Pioneer/Pro) — keep Settings working ---
  const { firebaseUid, email, priceId, tier, origin } = body;

  if (!firebaseUid || !email || !priceId || !tier || !origin) {
    return res.status(400).json({ error: 'Missing required fields: firebaseUid, email, priceId, tier, origin' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { firebaseUid, tier },
      success_url: `${origin}/settings?payment=success`,
      cancel_url: `${origin}/settings?payment=canceled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session creation failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
