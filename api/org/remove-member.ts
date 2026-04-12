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

async function getOrgMembership(db: FirebaseFirestore.Firestore, orgId: string, uid: string): Promise<{ role: 'admin' | 'member' } | null> {
    const snap = await db.collection('organizations').doc(orgId).collection('members').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return { role: (data?.role as 'admin' | 'member') || 'member' };
}

async function isOrgOwner(db: FirebaseFirestore.Firestore, orgId: string, uid: string): Promise<boolean> {
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) return false;
    return orgSnap.data()?.ownerId === uid;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await verifyAuth(req);
    if (!auth.ok) {
        return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
    }

    const { orgId, uid } = req.body;
    if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ error: 'Missing required field: orgId' });
    }
    if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'Missing required field: uid' });
    }

    let adminDb: FirebaseFirestore.Firestore;
    try {
        adminDb = getAdminDb();
    } catch (err: any) {
        console.error('Firebase Admin init failed:', err.message);
        return res.status(500).json({ error: 'Server configuration error', details: err.message });
    }

    try {
        const isSelfRemove = auth.uid === uid;
        if (!isSelfRemove) {
            const membership = await getOrgMembership(adminDb, orgId, auth.uid);
            if (!membership || membership.role !== 'admin') {
                return res.status(403).json({ error: 'You must be an admin to remove members' });
            }
        }

        if (await isOrgOwner(adminDb, orgId, uid)) {
            return res.status(400).json({ error: 'Cannot remove the organization owner' });
        }

        const orgRef = adminDb.collection('organizations').doc(orgId);

        await orgRef.collection('members').doc(uid).delete();

        await adminDb.collection('users').doc(uid).update({
            organizationId: FieldValue.delete(),
            orgRole: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('Remove member error:', err);
        return res.status(500).json({ error: 'Failed to remove member', details: err?.message || String(err) });
    }
}
