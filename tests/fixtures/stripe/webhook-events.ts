/**
 * Stripe webhook event fixtures matching Checkout metadata from
 * `api/create-checkout.ts` (metadata: { firebaseUid, tier }) and the
 * Firestore user.stripe shape in `src/types/user.ts`.
 */

import type {
    CheckoutSessionCompletedData,
    SubscriptionEventData,
    InvoicePaymentFailedData,
} from '../../api/lib/stripeWebhookContract';

export const FIXTURE_UID = 'firebase-user-abc123';
export const FIXTURE_CUSTOMER = 'cus_test_pioneer_001';
export const FIXTURE_SUBSCRIPTION = 'sub_test_pioneer_001';

/** Successful Pioneer (early_access) Checkout */
export const checkoutSessionCompletedPioneer: CheckoutSessionCompletedData = {
    id: 'cs_test_pioneer',
    customer: FIXTURE_CUSTOMER,
    subscription: FIXTURE_SUBSCRIPTION,
    metadata: {
        firebaseUid: FIXTURE_UID,
        tier: 'early_access',
    },
};

/** Successful Pro Checkout */
export const checkoutSessionCompletedPro: CheckoutSessionCompletedData = {
    id: 'cs_test_pro',
    customer: 'cus_test_pro_001',
    subscription: 'sub_test_pro_001',
    metadata: {
        firebaseUid: FIXTURE_UID,
        tier: 'pro',
    },
};

/** Malformed checkout — missing firebaseUid (handler must no-op / error) */
export const checkoutSessionMissingUid: CheckoutSessionCompletedData = {
    id: 'cs_test_bad',
    customer: FIXTURE_CUSTOMER,
    subscription: FIXTURE_SUBSCRIPTION,
    metadata: {
        tier: 'pro',
    },
};

export const subscriptionUpdatedActive: SubscriptionEventData = {
    id: FIXTURE_SUBSCRIPTION,
    customer: FIXTURE_CUSTOMER,
    status: 'active',
    current_period_end: 1_735_689_600, // fixed unix seconds
    metadata: {
        firebaseUid: FIXTURE_UID,
        tier: 'early_access',
    },
};

export const subscriptionUpdatedPastDue: SubscriptionEventData = {
    id: FIXTURE_SUBSCRIPTION,
    customer: FIXTURE_CUSTOMER,
    status: 'past_due',
    current_period_end: 1_735_689_600,
    metadata: {
        firebaseUid: FIXTURE_UID,
        tier: 'early_access',
    },
};

export const subscriptionDeleted: SubscriptionEventData = {
    id: FIXTURE_SUBSCRIPTION,
    customer: FIXTURE_CUSTOMER,
    status: 'canceled',
    current_period_end: 1_735_689_600,
    metadata: {
        firebaseUid: FIXTURE_UID,
        tier: 'early_access',
    },
};

export const invoicePaymentFailed: InvoicePaymentFailedData = {
    customer: FIXTURE_CUSTOMER,
    subscription: FIXTURE_SUBSCRIPTION,
    metadata: {
        firebaseUid: FIXTURE_UID,
    },
};

/** Envelope shapes as Stripe delivers them (for future HTTP handler tests) */
export const stripeEventEnvelopes = {
    checkoutCompleted: {
        id: 'evt_checkout_1',
        type: 'checkout.session.completed' as const,
        data: { object: checkoutSessionCompletedPioneer },
    },
    subscriptionUpdated: {
        id: 'evt_sub_updated_1',
        type: 'customer.subscription.updated' as const,
        data: { object: subscriptionUpdatedActive },
    },
    subscriptionDeleted: {
        id: 'evt_sub_deleted_1',
        type: 'customer.subscription.deleted' as const,
        data: { object: subscriptionDeleted },
    },
    invoiceFailed: {
        id: 'evt_invoice_failed_1',
        type: 'invoice.payment_failed' as const,
        data: { object: invoicePaymentFailed },
    },
};
