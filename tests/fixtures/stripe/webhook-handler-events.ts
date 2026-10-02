/**
 * Stripe webhook event fixtures shaped like objects from
 * `api/stripe-webhook.ts` (PR #4 billing lifecycle).
 *
 * Price IDs must match env STRIPE_PIONEER_PRICE_IDS / STRIPE_PRO_PRICE_IDS
 * used in tests.
 */

export const PRICE_PIONEER = 'price_pioneer_monthly_test';
export const PRICE_PRO = 'price_pro_monthly_test';
export const FIXTURE_UID = 'firebase-user-abc123';
export const FIXTURE_CUSTOMER = 'cus_test_pioneer_001';
export const FIXTURE_SUBSCRIPTION = 'sub_test_pioneer_001';
export const PERIOD_END_UNIX = 1_735_689_600; // fixed for assertions

export function makeSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: FIXTURE_SUBSCRIPTION,
        customer: FIXTURE_CUSTOMER,
        status: 'active',
        items: {
            data: [
                {
                    price: { id: PRICE_PIONEER },
                    current_period_end: PERIOD_END_UNIX,
                },
            ],
        },
        ...overrides,
    };
}

export function makeCheckoutSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cs_test_pioneer',
        customer: FIXTURE_CUSTOMER,
        subscription: FIXTURE_SUBSCRIPTION,
        metadata: {
            firebaseUid: FIXTURE_UID,
            tier: 'early_access',
        },
        ...overrides,
    };
}

export function makeInvoice(overrides: Record<string, unknown> = {}) {
    return {
        id: 'in_test_failed',
        customer: FIXTURE_CUSTOMER,
        subscription: FIXTURE_SUBSCRIPTION,
        ...overrides,
    };
}

export function makeStripeEvent(
    type: string,
    object: Record<string, unknown>,
    id = `evt_${type.replace(/\./g, '_')}`
) {
    return {
        id,
        type,
        data: { object },
    };
}

export const checkoutSessionCompletedPioneer = makeStripeEvent(
    'checkout.session.completed',
    makeCheckoutSession()
);

export const checkoutSessionCompletedPro = makeStripeEvent(
    'checkout.session.completed',
    makeCheckoutSession({
        id: 'cs_test_pro',
        customer: 'cus_test_pro_001',
        subscription: 'sub_test_pro_001',
        metadata: { firebaseUid: FIXTURE_UID, tier: 'pro' },
    })
);

export const checkoutSessionMissingUid = makeStripeEvent(
    'checkout.session.completed',
    makeCheckoutSession({
        metadata: { tier: 'pro' },
    })
);

export const subscriptionUpdatedActive = makeStripeEvent(
    'customer.subscription.updated',
    makeSubscription({ status: 'active' })
);

export const subscriptionUpdatedPastDue = makeStripeEvent(
    'customer.subscription.updated',
    makeSubscription({ status: 'past_due' })
);

export const subscriptionUpdatedToPro = makeStripeEvent(
    'customer.subscription.updated',
    makeSubscription({
        status: 'active',
        items: {
            data: [
                {
                    price: { id: PRICE_PRO },
                    current_period_end: PERIOD_END_UNIX,
                },
            ],
        },
    })
);

export const subscriptionDeleted = makeStripeEvent(
    'customer.subscription.deleted',
    makeSubscription({ status: 'canceled' })
);

export const invoicePaymentFailed = makeStripeEvent(
    'invoice.payment_failed',
    makeInvoice()
);
