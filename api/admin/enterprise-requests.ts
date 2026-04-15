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
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

type AuthOk = { ok: true; uid: string; email: string | null; name: string | null };
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
    const name = typeof (payload as any).name === 'string' ? (payload as any).name : null;
    return { ok: true, uid, email, name };
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

/**
 * Owner-only admin endpoint for enterprise request management.
 * GET  → list all requests
 * POST { action: 'approve', requestId, seatLimit } → provision org, mark approved
 * POST { action: 'reject',  requestId, reason }    → mark rejected
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  if (!isOwnerEmail(auth.email)) return res.status(403).json({ error: 'Owner access required' });

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  if (req.method === 'GET') {
    try {
      const snap = await adminDb.collection('enterpriseRequests').get();
      const requests = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? null,
          resolvedAt: data.resolvedAt?.toMillis?.() ?? data.resolvedAt ?? null,
        };
      });
      return res.status(200).json({ requests });
    } catch (err: any) {
      console.error('List enterprise requests error:', err);
      return res.status(500).json({ error: err.message || 'Failed to list requests' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, requestId } = req.body || {};
  if (!action || !requestId) {
    return res.status(400).json({ error: 'Missing action or requestId' });
  }

  const reqRef = adminDb.collection('enterpriseRequests').doc(requestId);
  const now = FieldValue.serverTimestamp();

  if (action === 'reject') {
    const { reason } = req.body;
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(reqRef);
        if (!snap.exists) throw new Error('Request not found');
        const data = snap.data()!;
        if (data.status !== 'pending') throw new Error(`Request already ${data.status}`);
        tx.update(reqRef, {
          status: 'rejected',
          resolvedAt: now,
          resolvedBy: auth.uid,
          rejectionReason: typeof reason === 'string' ? reason.trim() : '',
        });
      });
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Reject request error:', err);
      const msg = err?.message || 'Failed to reject';
      const status = msg.includes('not found') ? 404
                   : msg.includes('already') ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  if (action === 'approve') {
    const { seatLimit } = req.body;
    if (!seatLimit || typeof seatLimit !== 'number' || seatLimit < 1) {
      return res.status(400).json({ error: 'Invalid seatLimit' });
    }

    try {
      // Pre-allocate org doc ID outside the transaction so we can return it
      const orgRef = adminDb.collection('organizations').doc();
      const orgId = orgRef.id;
      const memberRef = orgRef.collection('members');

      await adminDb.runTransaction(async (tx) => {
        // Re-read the request inside the transaction for race-safety.
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists) throw new Error('Request not found');
        const reqData = reqSnap.data()!;
        if (reqData.status !== 'pending') throw new Error(`Request already ${reqData.status}`);

        const customerUid = reqData.uid;
        const orgName = reqData.orgName;
        if (!customerUid || !orgName) throw new Error('Request is missing uid or orgName');

        const userRef = adminDb.collection('users').doc(customerUid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error('Customer user doc not found. They must sign in at least once first.');
        }
        const userData = userSnap.data()!;
        if (userData.organizationId) {
          throw new Error(`Customer already belongs to organization ${userData.organizationId}`);
        }

        const customerEmail = userData.email || '';
        const customerDisplayName = userData.displayName || customerEmail.split('@')[0] || 'Owner';

        // All writes are atomic — if any fails, none apply, no orphaned org.
        tx.set(orgRef, {
          name: orgName,
          ownerId: customerUid,
          seatLimit,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(memberRef.doc(customerUid), {
          uid: customerUid,
          email: customerEmail,
          displayName: customerDisplayName,
          role: 'admin',
          joinedAt: now,
          invitedBy: customerUid,
        });
        tx.update(userRef, {
          tier: 'enterprise',
          contactLimit: null,
          'scanUsage.lifetimeLimit': null,
          organizationId: orgId,
          orgRole: 'admin',
          updatedAt: now,
        });
        tx.update(reqRef, {
          status: 'approved',
          resolvedAt: now,
          resolvedBy: auth.uid,
          orgId,
        });
      });

      return res.status(200).json({ orgId });
    } catch (err: any) {
      console.error('Approve request error:', err);
      const msg = err?.message || 'Failed to approve';
      const status = msg.includes('not found') ? 404
                   : (msg.includes('already') || msg.includes('missing')) ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
