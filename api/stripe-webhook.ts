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

/** Lazily initialize Firebase Admin and return Firestore instance */
function getAdminDb() {
    if (!getApps().length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error('Firebase Admin credentials not configured');
        }

        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
        });
    }
    return getFirestore();
}

/** Read raw body from the request stream (needed for Stripe signature verification) */
async function getRawBody(req: VercelRequest): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks as unknown as Uint8Array[]).toString('utf8');
}

/** Determine tier from a Stripe price ID using server-side env vars */
function getTierFromPriceId(priceId: string): 'early_access' | 'pro' | null {
    const pioneerPrices = (process.env.STRIPE_PIONEER_PRICE_IDS || '').split(',').filter(Boolean);
    const proPrices = (process.env.STRIPE_PRO_PRICE_IDS || '').split(',').filter(Boolean);

    if (pioneerPrices.includes(priceId)) return 'early_access';
    if (proPrices.includes(priceId)) return 'pro';
    return null;
}

/** Find a user doc by their Stripe customer ID */
async function findUserByCustomerId(adminDb: FirebaseFirestore.Firestore, customerId: string) {
    const snapshot = await adminDb.collection('users')
        .where('stripe.customerId', '==', customerId)
        .limit(1)
        .get();
    return snapshot.empty ? null : snapshot.docs[0];
}

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

    // Verify webhook signature
    let event: Stripe.Event;
    try {
        const rawBody = await getRawBody(req);
        const sig = req.headers['stripe-signature'] as string;
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
        switch (event.type) {
            // --- User completes Stripe Checkout ---
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const firebaseUid = session.metadata?.firebaseUid;
                const tier = session.metadata?.tier as 'early_access' | 'pro' | undefined;

                if (!firebaseUid || !tier) {
                    console.error('Missing metadata in checkout session:', session.id);
                    break;
                }

                const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

                await adminDb.collection('users').doc(firebaseUid).update({
                    tier,
                    contactLimit: null,                              // Unlimited for paid users
                    'scanUsage.lifetimeLimit': null,                 // Unlimited for paid users
                    'stripe.customerId': session.customer as string,
                    'stripe.subscriptionId': subscription.id,
                    'stripe.subscriptionStatus': subscription.status,
                    'stripe.currentPeriodEnd': subscription.current_period_end * 1000,
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

                const updateData: Record<string, any> = {
                    'stripe.subscriptionStatus': subscription.status,
                    'stripe.currentPeriodEnd': subscription.current_period_end * 1000,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // If active with a recognized price, sync the tier (handles plan upgrades/downgrades)
                if (subscription.status === 'active' && tier) {
                    updateData.tier = tier;
                    updateData.contactLimit = null;
                    updateData['scanUsage.lifetimeLimit'] = null;
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

                await userDoc.ref.update({
                    tier: 'free',
                    contactLimit: 25,
                    'stripe.subscriptionId': null,
                    'stripe.subscriptionStatus': null,
                    'stripe.currentPeriodEnd': null,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                console.log(`User ${userDoc.id} downgraded to free (subscription deleted)`);
                break;
            }

            // --- Payment failed (Stripe auto-retries, mark as past_due) ---
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;

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
        }

        return res.status(200).json({ received: true });
    } catch (err: any) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
}
