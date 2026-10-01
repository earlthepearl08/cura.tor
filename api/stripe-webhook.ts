import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/** Disable automatic body parsing — Stripe signature verification needs the raw body */
export const config = {
  api: {
    bodyParser: false,
  },
};

const EVENT_PACK_CREDITS_PER_PURCHASE = 1;

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

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks as unknown as Uint8Array[]);
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

/**
 * Stripe webhook — Event pack fulfillment (one-time payment).
 *
 * Subscription tier upgrades (Pioneer/Pro) are handled by PR #4's fuller webhook.
 * This handler:
 *   - Grants eventPackCredits on checkout.session.completed when product=event_pack
 *   - Acks other events with 200 so Stripe doesn't retry endlessly before #4 merges
 *
 * When merging with PR #4, fold the event_pack branch of checkout.session.completed
 * into that file and keep a single /api/stripe-webhook endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const product = session.metadata?.product;
      const firebaseUid = session.metadata?.firebaseUid || session.client_reference_id || '';

      // Event pack (one-time payment)
      if (product === 'event_pack' || session.mode === 'payment') {
        if (product !== 'event_pack') {
          // Payment mode but not our product — ignore safely
          console.log('Ignoring non-event_pack payment checkout:', session.id);
          return res.status(200).json({ received: true });
        }
        if (!firebaseUid) {
          console.error('Event pack checkout missing firebaseUid:', session.id);
          return res.status(200).json({ received: true });
        }
        if (session.payment_status && session.payment_status !== 'paid') {
          console.log('Event pack checkout not paid yet:', session.id, session.payment_status);
          return res.status(200).json({ received: true });
        }

        // Optional: verify line item price is allowlisted
        const allowed = eventPackPriceIds();
        if (allowed.length > 0 && session.amount_total != null) {
          // Soft check via expanded line items when available
          try {
            const full = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items.data.price'],
            });
            const priceId = full.line_items?.data?.[0]?.price;
            const id = typeof priceId === 'string' ? priceId : priceId?.id;
            if (id && !allowed.includes(id)) {
              console.error('Event pack checkout used unrecognized price:', id, session.id);
              return res.status(200).json({ received: true });
            }
          } catch (err) {
            console.warn('Could not expand line items for price check:', err);
          }
        }

        const userRef = adminDb.collection('users').doc(firebaseUid);
        const credits = EVENT_PACK_CREDITS_PER_PURCHASE;
        await userRef.set({
          eventPackCredits: FieldValue.increment(credits),
          eventPackPurchased: FieldValue.increment(1),
          ...(session.customer
            ? { 'stripe.customerId': session.customer as string }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`Granted ${credits} eventPackCredits to ${firebaseUid} via ${session.id}`);
        return res.status(200).json({ received: true });
      }

      // Subscription checkouts: leave to PR #4 webhook when merged.
      console.log('Subscription checkout.session.completed — defer to subscription webhook handler:', session.id);
    }

    // Ack everything else so Stripe doesn't hammer us before full billing lands
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message || 'Webhook failed' });
  }
}
