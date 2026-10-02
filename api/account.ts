import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/** Free-tier contact cap — mirrors src/types/user.ts TIER_LIMITS.free */
const FREE_CONTACT_LIMIT = 25;
const EARLY_ACCESS_CONTACT_LIMIT = 50;

function getAdminDb() {
  if (!getApps().length) {
    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID)?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey = privateKeyRaw?.replace(/\\n/g, '\n').trim();
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID env var missing or empty');
    if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL env var missing or empty');
    if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY env var missing or empty');
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY does not look like a PEM key');
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

type AuthOk = { ok: true; uid: string; email: string | null };
type AuthFail = { ok: false; reason: string };

async function verifyAuth(req: VercelRequest): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'no-bearer' };
  const token = authHeader.slice(7);
  if (!token) return { ok: false, reason: 'empty-token' };
  if (!FIREBASE_PROJECT_ID) return { ok: false, reason: 'server-missing-project-id' };
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid) return { ok: false, reason: 'missing-sub' };
    const email = typeof (payload as any).email === 'string' ? (payload as any).email : null;
    return { ok: true, uid, email };
  } catch (err: any) {
    return { ok: false, reason: `jwt-${err?.code || err?.message || 'unknown'}` };
  }
}

function isOwnerEmail(email: string | null): boolean {
  if (!email) return false;
  const owners = (process.env.OWNER_EMAILS || 'earldy.kinmo@gmail.com')
    .split(',').map(e => e.trim().toLowerCase());
  return owners.includes(email.toLowerCase());
}

function contactLimitForTier(tier: string): number | null {
  if (tier === 'pro' || tier === 'enterprise') return null;
  if (tier === 'early_access') return EARLY_ACCESS_CONTACT_LIMIT;
  return FREE_CONTACT_LIMIT;
}

/**
 * Account endpoint (consolidated to stay under Vercel Hobby function caps).
 *
 * POST with no action / action=delete → delete caller's account (existing behavior).
 * POST { action: 'redeem-access-code', code } → Admin-SDK tier upgrade via access code.
 * POST { action: 'bootstrap-owner' } → OWNER_EMAILS only: ensure founder is pro.
 *
 * Client Firebase Auth deletion still happens after delete returns 200.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });

  const action = typeof req.body?.action === 'string' ? req.body.action : 'delete';

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  if (action === 'bootstrap-owner') {
    if (!isOwnerEmail(auth.email)) {
      return res.status(403).json({ error: 'Owner access required' });
    }
    try {
      const userRef = adminDb.collection('users').doc(auth.uid);
      const snap = await userRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      const data = snap.data()!;
      if (data.tier === 'pro' || data.tier === 'enterprise') {
        return res.status(200).json({ ok: true, tier: data.tier, changed: false });
      }
      await userRef.update({
        tier: 'pro',
        contactLimit: null,
        'scanUsage.lifetimeLimit': null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ ok: true, tier: 'pro', changed: true });
    } catch (err: any) {
      console.error('bootstrap-owner error:', err);
      return res.status(500).json({ error: err.message || 'Failed to bootstrap owner' });
    }
  }

  if (action === 'redeem-access-code') {
    const rawCode = req.body?.code;
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return res.status(400).json({ error: 'Missing code' });
    }
    const code = rawCode.trim().toUpperCase();

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const codeRef = adminDb.collection('accessCodes').doc(code);
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists) {
          return { ok: false as const, status: 404, error: 'Invalid access code' };
        }
        const codeData = codeSnap.data()!;
        if (!codeData.isActive) {
          return { ok: false as const, status: 400, error: 'This code has expired' };
        }
        const maxUses = typeof codeData.maxUses === 'number' ? codeData.maxUses : 0;
        const currentUses = typeof codeData.currentUses === 'number' ? codeData.currentUses : 0;
        if (maxUses > 0 && currentUses >= maxUses) {
          return { ok: false as const, status: 400, error: 'This code has reached its usage limit' };
        }
        const redeemedBy: string[] = Array.isArray(codeData.redeemedBy) ? codeData.redeemedBy : [];
        if (redeemedBy.includes(auth.uid)) {
          return { ok: false as const, status: 400, error: 'You have already used this code' };
        }

        const userRef = adminDb.collection('users').doc(auth.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          return { ok: false as const, status: 404, error: 'User not found' };
        }
        const userData = userSnap.data()!;
        if (userData.tier === 'pro' || userData.tier === 'enterprise') {
          return { ok: false as const, status: 400, error: 'You already have Pro access' };
        }

        const tier = codeData.tier === 'pro' ? 'pro' : 'early_access';
        const scanLimit = codeData.scanLimit === undefined ? null : codeData.scanLimit;
        if (scanLimit !== null && (typeof scanLimit !== 'number' || scanLimit < 1)) {
          return { ok: false as const, status: 500, error: 'Access code misconfigured (scanLimit)' };
        }

        tx.update(userRef, {
          tier,
          'scanUsage.lifetimeLimit': scanLimit,
          contactLimit: contactLimitForTier(tier),
          accessCode: { code, redeemedAt: Date.now() },
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(codeRef, {
          currentUses: currentUses + 1,
          redeemedBy: FieldValue.arrayUnion(auth.uid),
        });

        const message = scanLimit
          ? `Access code redeemed! You now have ${scanLimit} scans.`
          : 'Access code redeemed! Pioneer features unlocked — unlimited scans and up to 50 contacts.';

        return { ok: true as const, tier, message };
      });

      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(200).json({
        success: true,
        message: result.message,
        tier: result.tier,
      });
    } catch (err: any) {
      console.error('redeem-access-code error:', err);
      return res.status(500).json({ error: err.message || 'Failed to redeem code' });
    }
  }

  if (action !== 'delete') {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  // --- Delete account (legacy default) ---
  if (isOwnerEmail(auth.email)) {
    return res.status(403).json({
      error: 'Owner accounts cannot be deleted through the app. Contact support or remove the email from OWNER_EMAILS first.',
    });
  }

  const uid = auth.uid;
  const userRef = adminDb.collection('users').doc(uid);

  try {
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data()! : null;

    const subscriptionId =
      typeof userData?.stripe?.subscriptionId === 'string'
        ? userData.stripe.subscriptionId
        : null;
    if (subscriptionId) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        console.error('STRIPE_SECRET_KEY missing; cannot cancel subscription on account delete');
        return res.status(500).json({
          error: 'Billing is not configured. Cancel your subscription from Settings before deleting your account, or contact support.',
          phase: 'stripe-cancel',
        });
      }
      try {
        const stripe = new Stripe(stripeSecretKey);
        await stripe.subscriptions.cancel(subscriptionId);
      } catch (err: any) {
        const code = err?.code || err?.raw?.code;
        const status = err?.statusCode || err?.status;
        if (code !== 'resource_missing' && status !== 404) {
          console.error('Stripe subscription cancel failed:', err);
          return res.status(500).json({
            error: 'Failed to cancel your Stripe subscription. Please manage billing first or try again.',
            phase: 'stripe-cancel',
          });
        }
      }
    }

    if (userData?.organizationId) {
      const orgId = userData.organizationId;
      const orgRef = adminDb.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();

      if (orgSnap.exists) {
        const orgData = orgSnap.data()!;
        const isOwner = orgData.ownerId === uid;

        if (isOwner) {
          const membersSnap = await orgRef.collection('members').get();
          const others = membersSnap.docs.filter(d => d.id !== uid);
          if (others.length > 0) {
            return res.status(400).json({
              error: `You're the owner of ${orgData.name} and there are still ${others.length} other member(s). Transfer ownership or remove all members before deleting your account.`,
            });
          }
          const invitesSnap = await orgRef.collection('invites').get();
          const contactsSnap = await orgRef.collection('contacts').get();
          const foldersSnap = await orgRef.collection('folders').get();
          const batchesSnap = await orgRef.collection('batches').get();
          const batch = adminDb.batch();
          invitesSnap.docs.forEach(d => batch.delete(d.ref));
          contactsSnap.docs.forEach(d => batch.delete(d.ref));
          foldersSnap.docs.forEach(d => batch.delete(d.ref));
          batchesSnap.docs.forEach(d => batch.delete(d.ref));
          batch.delete(orgRef.collection('members').doc(uid));
          batch.delete(orgRef);
          await batch.commit();
        } else {
          await orgRef.collection('members').doc(uid).delete();
        }
      }
    }

    const sentInvitesSnap = await adminDb.collectionGroup('invites')
      .where('invitedBy', '==', uid)
      .where('status', '==', 'pending')
      .get();
    if (!sentInvitesSnap.empty) {
      const batch = adminDb.batch();
      sentInvitesSnap.docs.forEach(d => batch.update(d.ref, { status: 'revoked' }));
      await batch.commit();
    }

    const requestsSnap = await adminDb.collection('enterpriseRequests')
      .where('uid', '==', uid).get();
    if (!requestsSnap.empty) {
      const batch = adminDb.batch();
      requestsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    if (userSnap.exists) {
      await userRef.delete();
    }

    return res.status(200).json({
      ok: true,
      message: 'Account data deleted. Firebase Auth deletion is happening client-side.',
    });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to delete account',
    });
  }
}
