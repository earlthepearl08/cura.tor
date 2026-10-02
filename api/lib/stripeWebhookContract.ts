/**
 * Stripe → Firestore tier update contract.
 *
 * Pure helpers that map verified Stripe webhook events to the Firestore
 * `users/{uid}` patch expected by the product (see product readiness review P0).
 * The HTTP handler (`api/stripe-webhook.ts`) should call these after signature
 * verification; tests assert the contract without live Stripe/Firestore.
 */

export type UserTier = 'free' | 'early_access' | 'pro' | 'enterprise';

export type StripeSubscriptionStatus =
    | 'active'
    | 'canceled'
    | 'past_due'
    | 'unpaid'
    | null;

export interface StripeUserFields {
    customerId: string;
    subscriptionId: string | null;
    subscriptionStatus: StripeSubscriptionStatus;
    currentPeriodEnd: number | null;
}

/** Partial Firestore `users/{uid}` document written by webhook handling */
export interface UserTierPatch {
    tier?: UserTier;
    contactLimit?: number | null;
    stripe?: StripeUserFields;
    updatedAt?: number;
    /** Cleared when a paid subscription activates */
    expiresAt?: null;
    trialSourceTier?: null;
}

export interface CheckoutSessionCompletedData {
    id: string;
    customer: string | null;
    subscription: string | null;
    metadata: {
        firebaseUid?: string;
        tier?: string;
    };
}

export interface SubscriptionEventData {
    id: string;
    customer: string;
    status: string;
    /** Unix seconds */
    current_period_end?: number;
    metadata?: {
        firebaseUid?: string;
        tier?: string;
    };
    /** Present on some Stripe payloads when checkout wrote it */
    items?: {
        data?: Array<{
            price?: { metadata?: { tier?: string } };
        }>;
    };
}

export interface InvoicePaymentFailedData {
    customer: string;
    subscription: string | null;
    /** Lookup key when subscription metadata is unavailable */
    metadata?: { firebaseUid?: string };
}

const PAID_TIERS: UserTier[] = ['early_access', 'pro', 'enterprise'];

const CONTACT_LIMITS: Record<UserTier, number | null> = {
    free: 25,
    early_access: 50,
    pro: null,
    enterprise: 30,
};

export function isPaidTier(value: string | undefined): value is UserTier {
    return !!value && (PAID_TIERS as string[]).includes(value);
}

export function normalizeSubscriptionStatus(
    status: string | null | undefined
): StripeSubscriptionStatus {
    if (
        status === 'active' ||
        status === 'canceled' ||
        status === 'past_due' ||
        status === 'unpaid'
    ) {
        return status;
    }
    if (status === 'trialing') return 'active';
    return null;
}

/**
 * checkout.session.completed — activate tier from Checkout metadata.
 * Requires metadata.firebaseUid + metadata.tier (set by create-checkout).
 */
export function patchFromCheckoutCompleted(
    session: CheckoutSessionCompletedData
): { uid: string; patch: UserTierPatch } | { error: string } {
    const uid = session.metadata?.firebaseUid;
    const tier = session.metadata?.tier;

    if (!uid) {
        return { error: 'Missing metadata.firebaseUid on checkout session' };
    }
    if (!isPaidTier(tier)) {
        return { error: `Invalid or missing metadata.tier: ${tier ?? '(none)'}` };
    }
    if (!session.customer) {
        return { error: 'Missing customer on checkout session' };
    }

    return {
        uid,
        patch: {
            tier,
            contactLimit: CONTACT_LIMITS[tier],
            stripe: {
                customerId: String(session.customer),
                subscriptionId: session.subscription ? String(session.subscription) : null,
                subscriptionStatus: 'active',
                currentPeriodEnd: null,
            },
            expiresAt: null,
            trialSourceTier: null,
            updatedAt: Date.now(),
        },
    };
}

/**
 * customer.subscription.updated — sync status / period end; keep or set tier.
 */
export function patchFromSubscriptionUpdated(
    subscription: SubscriptionEventData,
    opts: { firebaseUid: string; fallbackTier?: UserTier }
): { uid: string; patch: UserTierPatch } | { error: string } {
    const uid = opts.firebaseUid || subscription.metadata?.firebaseUid;
    if (!uid) {
        return { error: 'Missing firebaseUid for subscription.updated' };
    }

    const metaTier = subscription.metadata?.tier;
    const tier = isPaidTier(metaTier)
        ? metaTier
        : opts.fallbackTier && isPaidTier(opts.fallbackTier)
            ? opts.fallbackTier
            : undefined;

    const status = normalizeSubscriptionStatus(subscription.status);
    const periodEnd = subscription.current_period_end
        ? subscription.current_period_end * 1000
        : null;

    const patch: UserTierPatch = {
        stripe: {
            customerId: String(subscription.customer),
            subscriptionId: subscription.id,
            subscriptionStatus: status,
            currentPeriodEnd: periodEnd,
        },
        updatedAt: Date.now(),
    };

    // Active / trialing paid sub → ensure tier is set
    if ((status === 'active') && tier) {
        patch.tier = tier;
        patch.contactLimit = CONTACT_LIMITS[tier];
        patch.expiresAt = null;
        patch.trialSourceTier = null;
    }

    // Canceled or unpaid → downgrade (Stripe may send updated before deleted)
    if (status === 'canceled' || status === 'unpaid') {
        patch.tier = 'free';
        patch.contactLimit = CONTACT_LIMITS.free;
    }

    if (status === 'past_due' && tier) {
        // Keep tier but mark past_due so Settings can show billing issues
        patch.tier = tier;
        patch.contactLimit = CONTACT_LIMITS[tier];
    }

    return { uid, patch };
}

/**
 * customer.subscription.deleted — revert to free, clear live subscription id.
 */
export function patchFromSubscriptionDeleted(
    subscription: SubscriptionEventData,
    opts: { firebaseUid: string }
): { uid: string; patch: UserTierPatch } | { error: string } {
    const uid = opts.firebaseUid || subscription.metadata?.firebaseUid;
    if (!uid) {
        return { error: 'Missing firebaseUid for subscription.deleted' };
    }

    return {
        uid,
        patch: {
            tier: 'free',
            contactLimit: CONTACT_LIMITS.free,
            stripe: {
                customerId: String(subscription.customer),
                subscriptionId: null,
                subscriptionStatus: 'canceled',
                currentPeriodEnd: subscription.current_period_end
                    ? subscription.current_period_end * 1000
                    : null,
            },
            updatedAt: Date.now(),
        },
    };
}

/**
 * invoice.payment_failed — mark subscription past_due (tier unchanged).
 */
export function patchFromInvoicePaymentFailed(
    invoice: InvoicePaymentFailedData,
    opts: {
        firebaseUid: string;
        existingStripe?: Partial<StripeUserFields>;
    }
): { uid: string; patch: UserTierPatch } | { error: string } {
    const uid = opts.firebaseUid || invoice.metadata?.firebaseUid;
    if (!uid) {
        return { error: 'Missing firebaseUid for invoice.payment_failed' };
    }

    const customerId =
        opts.existingStripe?.customerId || String(invoice.customer);

    return {
        uid,
        patch: {
            stripe: {
                customerId,
                subscriptionId:
                    invoice.subscription ??
                    opts.existingStripe?.subscriptionId ??
                    null,
                subscriptionStatus: 'past_due',
                currentPeriodEnd: opts.existingStripe?.currentPeriodEnd ?? null,
            },
            updatedAt: Date.now(),
        },
    };
}

export type StripeWebhookEventType =
    | 'checkout.session.completed'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
    | 'invoice.payment_failed';

/**
 * Dispatch a typed event payload to the matching patch builder.
 * Lookup of firebaseUid by customerId is the handler's job when metadata is absent.
 */
export function applyStripeEvent(
    type: StripeWebhookEventType,
    data: CheckoutSessionCompletedData | SubscriptionEventData | InvoicePaymentFailedData,
    ctx: { firebaseUid?: string; fallbackTier?: UserTier; existingStripe?: Partial<StripeUserFields> } = {}
): { uid: string; patch: UserTierPatch } | { error: string } {
    switch (type) {
        case 'checkout.session.completed':
            return patchFromCheckoutCompleted(data as CheckoutSessionCompletedData);
        case 'customer.subscription.updated':
            if (!ctx.firebaseUid && !(data as SubscriptionEventData).metadata?.firebaseUid) {
                return { error: 'firebaseUid required for subscription.updated' };
            }
            return patchFromSubscriptionUpdated(data as SubscriptionEventData, {
                firebaseUid: ctx.firebaseUid || '',
                fallbackTier: ctx.fallbackTier,
            });
        case 'customer.subscription.deleted':
            if (!ctx.firebaseUid && !(data as SubscriptionEventData).metadata?.firebaseUid) {
                return { error: 'firebaseUid required for subscription.deleted' };
            }
            return patchFromSubscriptionDeleted(data as SubscriptionEventData, {
                firebaseUid: ctx.firebaseUid || '',
            });
        case 'invoice.payment_failed':
            if (!ctx.firebaseUid && !(data as InvoicePaymentFailedData).metadata?.firebaseUid) {
                return { error: 'firebaseUid required for invoice.payment_failed' };
            }
            return patchFromInvoicePaymentFailed(data as InvoicePaymentFailedData, {
                firebaseUid: ctx.firebaseUid || '',
                existingStripe: ctx.existingStripe,
            });
        default:
            return { error: `Unhandled event type: ${type as string}` };
    }
}
