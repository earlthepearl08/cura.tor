import { describe, it, expect, vi } from 'vitest';
import {
    applyStripeEvent,
    patchFromCheckoutCompleted,
    patchFromSubscriptionUpdated,
    patchFromSubscriptionDeleted,
    patchFromInvoicePaymentFailed,
} from '../lib/stripeWebhookContract';
import {
    checkoutSessionCompletedPioneer,
    checkoutSessionCompletedPro,
    checkoutSessionMissingUid,
    subscriptionUpdatedActive,
    subscriptionUpdatedPastDue,
    subscriptionDeleted,
    invoicePaymentFailed,
    FIXTURE_UID,
    FIXTURE_CUSTOMER,
    FIXTURE_SUBSCRIPTION,
    stripeEventEnvelopes,
} from '../../tests/fixtures/stripe/webhook-events';

describe('Stripe webhook → Firestore tier contract', () => {
    it('checkout.session.completed upgrades free → early_access (Pioneer)', () => {
        const result = patchFromCheckoutCompleted(checkoutSessionCompletedPioneer);
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.uid).toBe(FIXTURE_UID);
        expect(result.patch.tier).toBe('early_access');
        expect(result.patch.contactLimit).toBe(50);
        expect(result.patch.stripe).toEqual({
            customerId: FIXTURE_CUSTOMER,
            subscriptionId: FIXTURE_SUBSCRIPTION,
            subscriptionStatus: 'active',
            currentPeriodEnd: null,
        });
        expect(result.patch.expiresAt).toBeNull();
        expect(result.patch.trialSourceTier).toBeNull();
    });

    it('checkout.session.completed upgrades free → pro', () => {
        const result = patchFromCheckoutCompleted(checkoutSessionCompletedPro);
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.patch.tier).toBe('pro');
        expect(result.patch.contactLimit).toBeNull();
        expect(result.patch.stripe?.subscriptionStatus).toBe('active');
    });

    it('checkout.session.completed rejects missing firebaseUid', () => {
        const result = patchFromCheckoutCompleted(checkoutSessionMissingUid);
        expect(result).toEqual({
            error: 'Missing metadata.firebaseUid on checkout session',
        });
    });

    it('customer.subscription.updated syncs period end and keeps paid tier', () => {
        const result = patchFromSubscriptionUpdated(subscriptionUpdatedActive, {
            firebaseUid: FIXTURE_UID,
        });
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.patch.tier).toBe('early_access');
        expect(result.patch.stripe?.subscriptionStatus).toBe('active');
        expect(result.patch.stripe?.currentPeriodEnd).toBe(1_735_689_600 * 1000);
    });

    it('customer.subscription.updated past_due keeps tier but flags status', () => {
        const result = patchFromSubscriptionUpdated(subscriptionUpdatedPastDue, {
            firebaseUid: FIXTURE_UID,
        });
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.patch.tier).toBe('early_access');
        expect(result.patch.stripe?.subscriptionStatus).toBe('past_due');
    });

    it('customer.subscription.deleted downgrades to free', () => {
        const result = patchFromSubscriptionDeleted(subscriptionDeleted, {
            firebaseUid: FIXTURE_UID,
        });
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.patch.tier).toBe('free');
        expect(result.patch.contactLimit).toBe(25);
        expect(result.patch.stripe?.subscriptionId).toBeNull();
        expect(result.patch.stripe?.subscriptionStatus).toBe('canceled');
    });

    it('invoice.payment_failed marks stripe status past_due without changing tier key', () => {
        const result = patchFromInvoicePaymentFailed(invoicePaymentFailed, {
            firebaseUid: FIXTURE_UID,
            existingStripe: {
                customerId: FIXTURE_CUSTOMER,
                subscriptionId: FIXTURE_SUBSCRIPTION,
                currentPeriodEnd: 1_735_689_600 * 1000,
            },
        });
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;

        expect(result.patch.tier).toBeUndefined();
        expect(result.patch.stripe?.subscriptionStatus).toBe('past_due');
        expect(result.patch.stripe?.customerId).toBe(FIXTURE_CUSTOMER);
    });

    it('applyStripeEvent dispatches envelope types used by the future HTTP handler', () => {
        const checkout = applyStripeEvent(
            stripeEventEnvelopes.checkoutCompleted.type,
            stripeEventEnvelopes.checkoutCompleted.data.object
        );
        expect(checkout).not.toHaveProperty('error');
        if ('error' in checkout) return;
        expect(checkout.patch.tier).toBe('early_access');

        const deleted = applyStripeEvent(
            stripeEventEnvelopes.subscriptionDeleted.type,
            stripeEventEnvelopes.subscriptionDeleted.data.object,
            { firebaseUid: FIXTURE_UID }
        );
        expect(deleted).not.toHaveProperty('error');
        if ('error' in deleted) return;
        expect(deleted.patch.tier).toBe('free');
    });

    it('writes updatedAt timestamps', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));
        const result = patchFromCheckoutCompleted(checkoutSessionCompletedPro);
        expect(result).not.toHaveProperty('error');
        if ('error' in result) return;
        expect(result.patch.updatedAt).toBe(Date.parse('2026-04-01T12:00:00Z'));
        vi.useRealTimers();
    });
});
