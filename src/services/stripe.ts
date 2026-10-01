import { UserTier } from '@/types/user';
import { authFetch } from '@/utils/authFetch';

export const STRIPE_PRICES = {
    pioneer: {
        monthly: {
            id: import.meta.env.VITE_STRIPE_PIONEER_MONTHLY_PRICE_ID || '',
            amount: 6.99,
            label: '$6.99/mo',
        },
        yearly: {
            id: import.meta.env.VITE_STRIPE_PIONEER_YEARLY_PRICE_ID || '',
            amount: 69.99,
            label: '$69.99/yr',
        },
    },
    pro: {
        monthly: {
            id: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || '',
            amount: 8.99,
            label: '$8.99/mo',
        },
        yearly: {
            id: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID || '',
            amount: 89.99,
            label: '$89.99/yr',
        },
    },
} as const;

/**
 * One-time Event pack SKU (not a subscription).
 * Amount is display-only placeholder — real charge comes from the Stripe Price in Dashboard.
 */
export const EVENT_PACK_PRICE = {
    id: import.meta.env.VITE_STRIPE_EVENT_PACK_PRICE_ID || '',
    /** Display placeholder until Dashboard price is set; do not hardcode a sell price in checkout. */
    amountLabel: 'One-time',
    label: 'Event pack',
    description: 'Adds one concurrent event-host slot (2–10 seats, short-lived show workspace).',
} as const;

export type StripePlan = 'pioneer' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

/** Map our plan names to the UserTier values stored in Firestore */
export const PLAN_TO_TIER: Record<StripePlan, UserTier> = {
    pioneer: 'early_access',
    pro: 'pro',
};

/** Create a Stripe Checkout session and return the redirect URL (Pioneer/Pro subscription). */
export async function createCheckoutSession(params: {
    firebaseUid: string;
    email: string;
    priceId: string;
    tier: UserTier;
}): Promise<string> {
    const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...params,
            origin: window.location.origin,
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create checkout session');
    }

    const { url } = await res.json();
    return url;
}

/**
 * One-time Event pack Checkout. Requires signed-in user (Bearer token).
 * Redirects back to /events?payment=… so capacity can refresh after webhook.
 */
export async function createEventPackCheckoutSession(): Promise<string> {
    const priceId = EVENT_PACK_PRICE.id;
    if (!priceId) {
        throw new Error('Event pack price is not configured (VITE_STRIPE_EVENT_PACK_PRICE_ID)');
    }

    const res = await authFetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product: 'event_pack',
            priceId,
            origin: window.location.origin,
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start Event pack checkout');
    }

    const { url } = await res.json();
    return url;
}

/** Create a Stripe Customer Portal session and return the redirect URL */
export async function createPortalSession(customerId: string): Promise<string> {
    const res = await fetch('/api/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customerId,
            origin: window.location.origin,
        }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create portal session');
    }

    const { url } = await res.json();
    return url;
}
