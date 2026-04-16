import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

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
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } catch (err: any) {
      throw new Error(`Firebase Admin initializeApp failed: ${err?.message || err}`);
    }
  }
  return getFirestore();
}

type AuthOk = { ok: true; uid: string; email: string | null; name: string | null };
type AuthFail = { ok: false; reason: string };

async function verifyAuth(req: VercelRequest): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { ok: false, reason: 'no-header' };
  if (!authHeader.startsWith('Bearer ')) return { ok: false, reason: 'wrong-scheme' };
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
    const name = typeof (payload as any).name === 'string' ? (payload as any).name : null;
    return { ok: true, uid, email, name };
  } catch (err: any) {
    return { ok: false, reason: `jwt-${err?.code || err?.message || 'unknown'}` };
  }
}

function isOwnerEmail(email: string | null): boolean {
    if (!email) return false;
    const ownerEmails = (process.env.OWNER_EMAILS || 'earldy.kinmo@gmail.com').split(',').map(e => e.trim().toLowerCase());
    return ownerEmails.includes(email.toLowerCase());
}

/**
 * Owner-only endpoint to provision a new enterprise customer.
 * Creates the org, sets the customer's tier to 'enterprise', and adds them as the org owner/admin.
 *
 * Input changed from customerEmail to customerUid because firebase-admin/auth
 * (getUserByEmail) does not bundle correctly on this Vercel project. The admin
 * (Earl) looks up the customer's uid in Firebase Console → Authentication →
 * Users before running this curl command.
 *
 * Body: { customerUid: string, orgName: string, seatLimit: number }
 * Returns: { orgId, ownerUid, message }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await verifyAuth(req);
    if (!auth.ok) {
        return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
    }

    if (!isOwnerEmail(auth.email)) {
        return res.status(403).json({ error: 'Owner access required' });
    }

    const { customerUid, orgName, seatLimit } = req.body;
    if (!customerUid || typeof customerUid !== 'string') {
        return res.status(400).json({ error: 'Missing required field: customerUid' });
    }
    if (!orgName || typeof orgName !== 'string' || orgName.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: orgName' });
    }
    if (!seatLimit || typeof seatLimit !== 'number' || seatLimit < 1) {
        return res.status(400).json({ error: 'Invalid seatLimit (must be a positive number)' });
    }

    let adminDb: FirebaseFirestore.Firestore;
    try {
        adminDb = getAdminDb();
    } catch (err: any) {
        console.error('Firebase Admin init failed:', err.message);
        return res.status(500).json({ error: 'Server configuration error', details: err.message });
    }

    try {
        const userRef = adminDb.collection('users').doc(customerUid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({
                error: 'Customer user doc not found. Customer must sign in to the app at least once first.',
            });
        }

        const userData = userSnap.data()!;
        if (userData.organizationId) {
            return res.status(400).json({
                error: `Customer is already a member of organization ${userData.organizationId}`,
            });
        }

        const customerEmail = userData.email || '';
        const customerDisplayName = userData.displayName || customerEmail.split('@')[0] || 'Owner';

        const orgRef = adminDb.collection('organizations').doc();
        const orgId = orgRef.id;
        const now = FieldValue.serverTimestamp();

        await orgRef.set({
            name: orgName.trim(),
            ownerId: customerUid,
            seatLimit,
            createdAt: now,
            updatedAt: now,
        });

        await orgRef.collection('members').doc(customerUid).set({
            uid: customerUid,
            email: customerEmail,
            displayName: customerDisplayName,
            role: 'admin',
            joinedAt: now,
            invitedBy: customerUid,
        });

        await userRef.update({
            tier: 'enterprise',
            // Personal workspace cap: 30 contacts (team workspace is unlimited)
            contactLimit: 30,
            'scanUsage.lifetimeLimit': null,
            organizationId: orgId,
            orgRole: 'admin',
            updatedAt: now,
        });

        return res.status(200).json({
            orgId,
            ownerUid: customerUid,
            message: `Provisioned ${orgName} for ${customerEmail} (${seatLimit} seats)`,
        });
    } catch (err: any) {
        console.error('Provision enterprise error:', err);
        return res.status(500).json({ error: err.message || 'Failed to provision enterprise customer' });
    }
}
