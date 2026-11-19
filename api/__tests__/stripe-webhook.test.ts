/**
 * Vitest coverage for `api/stripe-webhook.ts` (from PR #4).
 * Mocks Stripe signature verification + Firestore; no live network.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PassThrough, Readable } from 'node:stream';
import {
    PRICE_PIONEER,
    PRICE_PRO,
    FIXTURE_UID,
    FIXTURE_CUSTOMER,
    FIXTURE_SUBSCRIPTION,
    PERIOD_END_UNIX,
    makeSubscription,
    checkoutSessionCompletedPioneer,
    checkoutSessionCompletedPro,
    checkoutSessionMissingUid,
    subscriptionUpdatedActive,
    subscriptionUpdatedPastDue,
    subscriptionUpdatedToPro,
    subscriptionDeleted,
    invoicePaymentFailed,
} from '../../tests/fixtures/stripe/webhook-handler-events';

const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const userDocUpdate = vi.fn();
const queryGet = vi.fn();
const foundDocUpdate = vi.fn();

vi.mock('stripe', () => ({
    default: class MockStripe {
        webhooks = {
            constructEvent: (...args: unknown[]) => constructEvent(...args),
        };
        subscriptions = {
            retrieve: (...args: unknown[]) => retrieveSubscription(...args),
        };
    },
}));

vi.mock('firebase-admin/app', () => ({
    initializeApp: vi.fn(),
    cert: vi.fn((value: unknown) => value),
    // Pretend Admin is already initialized so env PEM is not required
    getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
}));

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIMESTAMP',
    },
    getFirestore: vi.fn(() => ({
        collection: () => ({
            doc: (uid: string) => ({
                update: (data: Record<string, unknown>) => userDocUpdate(uid, data),
            }),
            where: () => ({
                limit: () => ({
                    get: () => queryGet(),
                }),
            }),
        }),
    })),
}));

function mockRes() {
    const res = {
        statusCode: 200,
        payload: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data: unknown) {
            this.payload = data;
            return this;
        },
    };
    return res as typeof res & VercelResponse;
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
    // Body is delivered via data/end like a real request.
    const stream = new PassThrough();
    stream.end(Buffer.from('{}'));
    return Object.assign(stream, {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=testsig' },
        ...overrides,
    }) as unknown as VercelRequest;
}

function foundUserDoc(tier = 'early_access', id = FIXTURE_UID) {
    return {
        empty: false,
        docs: [
            {
                id,
                data: () => ({ tier }),
                ref: { update: foundDocUpdate },
            },
        ],
    };
}

describe('api/stripe-webhook handler', () => {
    let handler: typeof import('../stripe-webhook').default;

    beforeEach(async () => {
        vi.resetModules();
        constructEvent.mockReset();
        retrieveSubscription.mockReset();
        userDocUpdate.mockReset();
        queryGet.mockReset();
        foundDocUpdate.mockReset();
        userDocUpdate.mockResolvedValue(undefined);
        foundDocUpdate.mockResolvedValue(undefined);

        process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
        process.env.STRIPE_PIONEER_PRICE_IDS = PRICE_PIONEER;
        process.env.STRIPE_PRO_PRICE_IDS = PRICE_PRO;

        handler = (await import('../stripe-webhook')).default;
    });

    it('rejects non-POST methods', async () => {
        const res = mockRes();
        await handler(mockReq({ method: 'GET' }), res);
        expect(res.statusCode).toBe(405);
        expect(res.payload).toEqual({ error: 'Method not allowed' });
    });

    it('returns 500 when Stripe env is missing', async () => {
        delete process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        vi.resetModules();
        handler = (await import('../stripe-webhook')).default;

        const res = mockRes();
        await handler(mockReq(), res);
        expect(res.statusCode).toBe(500);
        expect(res.payload).toEqual({ error: 'Stripe not configured' });
    });

    it('returns 400 when stripe-signature header is missing', async () => {
        const res = mockRes();
        await handler(mockReq({ headers: {} }), res);
        expect(res.statusCode).toBe(400);
        expect(res.payload).toEqual({ error: 'Missing stripe-signature header' });
        expect(constructEvent).not.toHaveBeenCalled();
    });

    it('returns 400 when signature verification fails', async () => {
        constructEvent.mockImplementation(() => {
            throw new Error('bad sig');
        });
        const res = mockRes();
        await handler(mockReq(), res);
        expect(res.statusCode).toBe(400);
        expect(res.payload).toEqual({ error: 'Invalid signature' });
    });

    it('checkout.session.completed upgrades user to early_access via price map', async () => {
        constructEvent.mockReturnValue(checkoutSessionCompletedPioneer);
        retrieveSubscription.mockResolvedValue(
            makeSubscription({
                id: FIXTURE_SUBSCRIPTION,
                status: 'active',
            })
        );

        const res = mockRes();
        await handler(mockReq(), res);

        expect(res.statusCode).toBe(200);
        expect(res.payload).toEqual({ received: true });
        expect(retrieveSubscription).toHaveBeenCalledWith(FIXTURE_SUBSCRIPTION);
        expect(userDocUpdate).toHaveBeenCalledWith(
            FIXTURE_UID,
            expect.objectContaining({
                tier: 'early_access',
                contactLimit: 50,
                'scanUsage.lifetimeLimit': null,
                expiresAt: null,
                trialSourceTier: null,
                'stripe.customerId': FIXTURE_CUSTOMER,
                'stripe.subscriptionId': FIXTURE_SUBSCRIPTION,
                'stripe.subscriptionStatus': 'active',
                'stripe.currentPeriodEnd': PERIOD_END_UNIX * 1000,
                updatedAt: 'SERVER_TIMESTAMP',
            })
        );
    });

    it('checkout.session.completed upgrades user to pro when price is Pro', async () => {
        constructEvent.mockReturnValue(checkoutSessionCompletedPro);
        retrieveSubscription.mockResolvedValue(
            makeSubscription({
                id: 'sub_test_pro_001',
                customer: 'cus_test_pro_001',
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

        const res = mockRes();
        await handler(mockReq(), res);

        expect(res.statusCode).toBe(200);
        expect(userDocUpdate).toHaveBeenCalledWith(
            FIXTURE_UID,
            expect.objectContaining({
                tier: 'pro',
                contactLimit: null,
                'stripe.subscriptionStatus': 'active',
            })
        );
    });

    it('checkout.session.completed skips Firestore write when firebaseUid missing', async () => {
        constructEvent.mockReturnValue(checkoutSessionMissingUid);
        const res = mockRes();
        await handler(mockReq(), res);

        expect(res.statusCode).toBe(200);
        expect(res.payload).toEqual({ received: true });
        expect(retrieveSubscription).not.toHaveBeenCalled();
        expect(userDocUpdate).not.toHaveBeenCalled();
    });

    it('customer.subscription.updated syncs status, period end, and tier', async () => {
        constructEvent.mockReturnValue(subscriptionUpdatedActive);
        queryGet.mockResolvedValue(foundUserDoc('free'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(res.statusCode).toBe(200);
        expect(foundDocUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'early_access',
                contactLimit: 50,
                'stripe.subscriptionId': FIXTURE_SUBSCRIPTION,
                'stripe.subscriptionStatus': 'active',
                'stripe.currentPeriodEnd': PERIOD_END_UNIX * 1000,
                updatedAt: 'SERVER_TIMESTAMP',
            })
        );
    });

    it('customer.subscription.updated past_due keeps tier fields unset (status only sync)', async () => {
        constructEvent.mockReturnValue(subscriptionUpdatedPastDue);
        queryGet.mockResolvedValue(foundUserDoc('early_access'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(foundDocUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                'stripe.subscriptionStatus': 'past_due',
                'stripe.currentPeriodEnd': PERIOD_END_UNIX * 1000,
            })
        );
        const patch = foundDocUpdate.mock.calls[0][0] as Record<string, unknown>;
        expect(patch.tier).toBeUndefined();
    });

    it('customer.subscription.updated maps Pro price upgrades', async () => {
        constructEvent.mockReturnValue(subscriptionUpdatedToPro);
        queryGet.mockResolvedValue(foundUserDoc('early_access'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(foundDocUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'pro',
                contactLimit: null,
                'stripe.subscriptionStatus': 'active',
            })
        );
    });

    it('customer.subscription.deleted downgrades paid user to free', async () => {
        constructEvent.mockReturnValue(subscriptionDeleted);
        queryGet.mockResolvedValue(foundUserDoc('early_access'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(foundDocUpdate).toHaveBeenCalledWith({
            tier: 'free',
            contactLimit: 25,
            'stripe.subscriptionId': null,
            'stripe.subscriptionStatus': 'canceled',
            'stripe.currentPeriodEnd': null,
            updatedAt: 'SERVER_TIMESTAMP',
        });
    });

    it('customer.subscription.deleted does not clobber enterprise tier', async () => {
        constructEvent.mockReturnValue(subscriptionDeleted);
        queryGet.mockResolvedValue(foundUserDoc('enterprise'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(foundDocUpdate).toHaveBeenCalledWith({
            'stripe.subscriptionId': null,
            'stripe.subscriptionStatus': 'canceled',
            'stripe.currentPeriodEnd': null,
            updatedAt: 'SERVER_TIMESTAMP',
        });
        const patch = foundDocUpdate.mock.calls[0][0] as Record<string, unknown>;
        expect(patch.tier).toBeUndefined();
    });

    it('invoice.payment_failed marks subscriptionStatus past_due', async () => {
        constructEvent.mockReturnValue(invoicePaymentFailed);
        queryGet.mockResolvedValue(foundUserDoc('pro'));

        const res = mockRes();
        await handler(mockReq(), res);

        expect(foundDocUpdate).toHaveBeenCalledWith({
            'stripe.subscriptionStatus': 'past_due',
            updatedAt: 'SERVER_TIMESTAMP',
        });
    });

    it('acknowledges unknown event types without Firestore writes', async () => {
        constructEvent.mockReturnValue({
            id: 'evt_ping',
            type: 'ping',
            data: { object: {} },
        });

        const res = mockRes();
        await handler(mockReq(), res);

        expect(res.statusCode).toBe(200);
        expect(res.payload).toEqual({ received: true });
        expect(userDocUpdate).not.toHaveBeenCalled();
        expect(foundDocUpdate).not.toHaveBeenCalled();
    });
});

describe('getRawBody', () => {
    /** Mirrors @vercel/node addHelpers(): drain the request, then replay via data/end only. */
    async function vercelHelperRequest(payload: string) {
        const req = Readable.from([Buffer.from(payload.slice(0, 10)), Buffer.from(payload.slice(10))]) as any;
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(Buffer.from(c));
        const body = Buffer.concat(chunks as unknown as Uint8Array[]);
        const replicate = new PassThrough();
        const on = replicate.on.bind(replicate);
        const originalOn = req.on.bind(req);
        req.read = replicate.read.bind(replicate);
        req.on = req.addListener = (name: string, cb: any) =>
            name === 'data' || name === 'end' ? on(name, cb) : originalOn(name, cb);
        replicate.write(body);
        replicate.end();
        let bodyTouched = false;
        Object.defineProperty(req, 'body', { get() { bodyTouched = true; return JSON.parse(payload); } });
        return { req, wasBodyTouched: () => bodyTouched };
    }

    it('returns the exact signed bytes after Vercel helpers consumed the stream', async () => {
        const { getRawBody } = await import('../stripe-webhook');
        const payload = '{\n  "id": "evt_1",\n  "type": "checkout.session.completed"\n}';
        const { req, wasBodyTouched } = await vercelHelperRequest(payload);
        expect(req.readableEnded).toBe(true);
        const raw = await getRawBody(req);
        expect(raw.toString()).toBe(payload); // pretty-printed bytes, not re-serialized JSON
        expect(wasBodyTouched()).toBe(false);
    });

    it('times out instead of hanging when no body is ever delivered', async () => {
        const { getRawBody } = await import('../stripe-webhook');
        await expect(getRawBody(new PassThrough() as any, 20)).rejects.toThrow(/Timed out/);
    });
});
