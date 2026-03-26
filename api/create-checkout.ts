import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

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
    const { firebaseUid, email, priceId, tier, origin } = req.body;

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
