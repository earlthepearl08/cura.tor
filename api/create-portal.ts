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
    const { customerId, origin } = req.body;

    if (!customerId || !origin) {
        return res.status(400).json({ error: 'Missing required fields: customerId, origin' });
    }

    try {
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
