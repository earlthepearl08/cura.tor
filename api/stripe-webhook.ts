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

<<<<<<< /tmp/meld/26-main-stripe-webhook.ts
type PaidTier = 'early_access' | 'pro';

/** Lazily initialize Firebase Admin and return Firestore instance */
=======
const EVENT_PACK_CREDITS_PER_PURCHASE = 1;

>>>>>>> /tmp/meld/26-pr-stripe-webhook.ts
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

<<<<<<< /tmp/meld/26-main-stripe-webhook.ts
/** Read raw body from the request (needed for Stripe signature verification) */
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  // Some runtimes parse JSON already — re-serialize only as a last resort (signature will fail).
=======
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
>>>>>>> /tmp/meld/26-pr-stripe-webhook.ts
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks as unknown as Uint8Array[]);
}

<<<<<<< /tmp/meld/26-main-stripe-webhook.ts
/** Determine tier from a Stripe price ID using server-side env vars */
function getTierFromPriceId(priceId: string): PaidTier | null {
  const pioneerPrices = (process.env.STRIPE_PIONEER_PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const proPrices = (process.env.STRIPE_PRO_PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

  if (pioneerPrices.includes(priceId)) return 'early_access';
  if (proPrices.includes(priceId)) return 'pro';
  return null;
}

/** Contact storage for paid tiers (mirrors src/types/user.ts TIER_LIMITS) */
function contactLimitForTier(tier: PaidTier): number | null {
  return tier === 'pro' ? null : 50;
}

/**
 * Stripe SDK v18+ / Basil API: current_period_end lives on SubscriptionItem,
 * not Subscription. Prefer a recognized price item when present.
 */
function getPeriodEndMs(subscription: Stripe.Subscription): number | null {
  const items = subscription.items?.data || [];
  const planItem =
    items.find(item => item.price?.id && getTierFromPriceId(item.price.id)) ||
    items[0];
  const end = planItem?.current_period_end;
  return typeof end === 'number' ? end * 1000 : null;
}

/** Normalize Stripe statuses to the subset stored on UserProfile.stripe */
function normalizeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'active' | 'canceled' | 'past_due' | 'unpaid' | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
    case 'paused':
      return 'unpaid';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      // incomplete, etc. — don't grant entitlements yet
      return null;
  }
}

/** Find a user doc by their Stripe customer ID */
async function findUserByCustomerId(adminDb: FirebaseFirestore.Firestore, customerId: string) {
  const snapshot = await adminDb.collection('users')
    .where('stripe.customerId', '==', customerId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

=======
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
>>>>>>> /tmp/meld/26-pr-stripe-webhook.ts
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

<<<<<<< /tmp/meld/26-main-stripe-webhook.ts
  // Verify webhook signature
=======
>>>>>>> /tmp/meld/26-pr-stripe-webhook.ts
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
<<<<<<< /tmp/meld/26-main-stripe-webhook.ts
    switch (event.type) {
      // --- User completes Stripe Checkout ---
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firebaseUid = session.metadata?.firebaseUid;
        let tier = session.metadata?.tier as PaidTier | undefined;

        if (!firebaseUid) {
          console.error('Missing firebaseUid metadata in checkout session:', session.id);
          break;
        }

        if (!session.subscription) {
          console.error('Checkout session missing subscription:', session.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price?.id;
        const priceTier = priceId ? getTierFromPriceId(priceId) : null;
        // Prefer price→tier mapping; fall back to checkout metadata
        if (priceTier) tier = priceTier;
        if (tier !== 'early_access' && tier !== 'pro') {
          console.error('Unrecognized tier/price for checkout session:', session.id, priceId);
          break;
        }

        await adminDb.collection('users').doc(firebaseUid).update({
          tier,
          contactLimit: contactLimitForTier(tier),
          'scanUsage.lifetimeLimit': null,
          expiresAt: null,
          trialSourceTier: null,
          'stripe.customerId': session.customer as string,
          'stripe.subscriptionId': subscription.id,
          'stripe.subscriptionStatus': normalizeSubscriptionStatus(subscription.status) || 'active',
          'stripe.currentPeriodEnd': getPeriodEndMs(subscription),
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`User ${firebaseUid} upgraded to ${tier} via checkout ${session.id}`);
        break;
      }

      // --- Subscription updated (plan change, renewal, cancellation scheduled) ---
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userDoc = await findUserByCustomerId(adminDb, customerId);
        if (!userDoc) {
          console.error('No user found for Stripe customer:', customerId);
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const tier = priceId ? getTierFromPriceId(priceId) : null;
        const status = normalizeSubscriptionStatus(subscription.status);

        const updateData: Record<string, any> = {
          'stripe.subscriptionId': subscription.id,
          'stripe.subscriptionStatus': status,
          'stripe.currentPeriodEnd': getPeriodEndMs(subscription),
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Active/trialing with a recognized price → sync entitlements (handles upgrades/downgrades)
        if (status === 'active' && tier) {
          updateData.tier = tier;
          updateData.contactLimit = contactLimitForTier(tier);
          updateData['scanUsage.lifetimeLimit'] = null;
          updateData.expiresAt = null;
          updateData.trialSourceTier = null;
        }

        await userDoc.ref.update(updateData);
        console.log(`Subscription updated for ${userDoc.id}: status=${subscription.status}, tier=${tier}`);
        break;
      }

      // --- Subscription fully deleted (after cancellation period ends) ---
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const userDoc = await findUserByCustomerId(adminDb, customerId);
        if (!userDoc) break;

        // Don't clobber enterprise seats managed outside Stripe
        if (userDoc.data()?.tier === 'enterprise') {
          await userDoc.ref.update({
            'stripe.subscriptionId': null,
            'stripe.subscriptionStatus': 'canceled',
            'stripe.currentPeriodEnd': null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          break;
        }

        await userDoc.ref.update({
          tier: 'free',
          contactLimit: 25,
          'stripe.subscriptionId': null,
          'stripe.subscriptionStatus': 'canceled',
          'stripe.currentPeriodEnd': null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`User ${userDoc.id} downgraded to free (subscription deleted)`);
        break;
      }

      // --- Payment failed (Stripe auto-retries, mark as past_due) ---
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        if (!customerId) break;

        const userDoc = await findUserByCustomerId(adminDb, customerId);
        if (userDoc) {
          await userDoc.ref.update({
            'stripe.subscriptionStatus': 'past_due',
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`Payment failed for user ${userDoc.id}, marked as past_due`);
        }
        break;
      }

      default:
        // Acknowledge unhandled events so Stripe doesn't retry
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
=======
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
>>>>>>> /tmp/meld/26-pr-stripe-webhook.ts
  }
}
