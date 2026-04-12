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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await verifyAuth(req);
    if (!auth.ok) {
        return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Missing required field: code' });
    }

    let adminDb: FirebaseFirestore.Firestore;
    try {
        adminDb = getAdminDb();
    } catch (err: any) {
        console.error('Firebase Admin init failed:', err.message);
        return res.status(500).json({ error: 'Server configuration error', details: err.message });
    }

    try {
        const normalizedCode = code.trim().toUpperCase();

        const invitesSnap = await adminDb.collectionGroup('invites')
            .where('code', '==', normalizedCode)
            .limit(1)
            .get();

        if (invitesSnap.empty) {
            return res.status(404).json({ error: 'Invalid invite code' });
        }

        const inviteDoc = invitesSnap.docs[0];
        const invite = inviteDoc.data();

        if (invite.status !== 'pending') {
            return res.status(400).json({ error: `This invite has already been ${invite.status}` });
        }

        const orgRef = inviteDoc.ref.parent.parent!;
        const orgId = orgRef.id;

        const userRef = adminDb.collection('users').doc(auth.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userSnap.data()!;

        if (userData.organizationId && userData.organizationId !== orgId) {
            return res.status(400).json({ error: 'You are already a member of another organization. Leave it first.' });
        }

        const orgSnap = await orgRef.get();
        if (!orgSnap.exists) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        const orgData = orgSnap.data()!;

        const membersSnap = await orgRef.collection('members').get();
        if (membersSnap.size >= (orgData.seatLimit || 5)) {
            return res.status(400).json({ error: 'Team is full. Contact your admin.' });
        }

        const email = auth.email || '';
        const displayName = auth.name || userData.displayName || email.split('@')[0] || 'Member';

        await orgRef.collection('members').doc(auth.uid).set({
            uid: auth.uid,
            email,
            displayName,
            role: invite.role || 'member',
            joinedAt: FieldValue.serverTimestamp(),
            invitedBy: invite.invitedBy || '',
        });

        await userRef.update({
            organizationId: orgId,
            orgRole: invite.role || 'member',
            updatedAt: FieldValue.serverTimestamp(),
        });

        await inviteDoc.ref.update({
            status: 'accepted',
            acceptedBy: auth.uid,
            acceptedAt: FieldValue.serverTimestamp(),
        });

        return res.status(200).json({ orgId, orgName: orgData.name });
    } catch (err: any) {
        console.error('Accept invite error:', err);
        return res.status(500).json({ error: 'Failed to accept invite', details: err?.message || String(err) });
    }
}
