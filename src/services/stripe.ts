import { UserTier } from '@/types/user';

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

export type StripePlan = 'pioneer' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

/** Map our plan names to the UserTier values stored in Firestore */
export const PLAN_TO_TIER: Record<StripePlan, UserTier> = {
    pioneer: 'early_access',
    pro: 'pro',
};

/** Create a Stripe Checkout session and return the redirect URL */
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
