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

function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = await verifyAuth(req);
    if (!auth.ok) {
        return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
    }

    const { orgId, email, role } = req.body;
    if (!orgId || typeof orgId !== 'string') {
        return res.status(400).json({ error: 'Missing required field: orgId' });
    }
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Missing required field: email' });
    }
    if (role !== 'admin' && role !== 'member') {
        return res.status(400).json({ error: 'Invalid role (must be admin or member)' });
    }

    let adminDb: FirebaseFirestore.Firestore;
    try {
        adminDb = getAdminDb();
    } catch (err: any) {
        console.error('Firebase Admin init failed:', err.message);
        return res.status(500).json({ error: 'Server configuration error', details: err.message });
    }

    try {
        const membership = await getOrgMembership(adminDb, orgId, auth.uid);
        if (!membership || membership.role !== 'admin') {
            return res.status(403).json({ error: 'You must be an admin to invite members' });
        }

        const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
        if (!orgSnap.exists) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        const orgData = orgSnap.data()!;
        const seatLimit = orgData.seatLimit || 5;

        const membersSnap = await adminDb.collection('organizations').doc(orgId).collection('members').get();
        const pendingInvitesSnap = await adminDb.collection('organizations').doc(orgId).collection('invites')
            .where('status', '==', 'pending').get();

        if (membersSnap.size + pendingInvitesSnap.size >= seatLimit) {
            return res.status(400).json({ error: `Seat limit reached (${seatLimit}). Remove members or upgrade your plan.` });
        }

        const code = generateInviteCode();
        const callerName = auth.name || (auth.email || '').split('@')[0] || 'Admin';

        await adminDb.collection('organizations').doc(orgId).collection('invites').doc(code).set({
            code,
            email: email.toLowerCase().trim(),
            role,
            invitedBy: auth.uid,
            invitedByName: callerName,
            invitedAt: FieldValue.serverTimestamp(),
            status: 'pending',
        });

        const origin = (req.headers.origin as string) || process.env.APP_URL || '';
        const inviteUrl = `${origin}/invite/${code}`;

        return res.status(200).json({ code, inviteUrl });
    } catch (err: any) {
        console.error('Create invite error:', err);
        return res.status(500).json({ error: 'Failed to create invite', details: err?.message || String(err) });
    }
}
