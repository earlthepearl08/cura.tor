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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment()}-${segment()}`;
}

/**
 * Consolidated organization endpoint.
 * POST { action: 'create' | 'invite' | 'accept-invite' | 'remove-member' | 'update-role' | 'revoke-invite', ... }
 * Merged from api/org/* to stay under Vercel Hobby's 12-function cap.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  const { action } = req.body || {};

  try {
    switch (action) {
      case 'create': {
        const { name, seatLimit } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Missing required field: name' });
        }
        if (!seatLimit || typeof seatLimit !== 'number' || seatLimit < 1) {
          return res.status(400).json({ error: 'Invalid seatLimit' });
        }
        const uid = auth.uid;
        const email = auth.email || '';
        const displayName = auth.name || email.split('@')[0] || 'Owner';
        const orgRef = adminDb.collection('organizations').doc();
        const orgId = orgRef.id;
        const now = FieldValue.serverTimestamp();

        await orgRef.set({ name: name.trim(), ownerId: uid, seatLimit, createdAt: now, updatedAt: now });
        await orgRef.collection('members').doc(uid).set({
          uid, email, displayName, role: 'admin', joinedAt: now, invitedBy: uid,
        });
        await adminDb.collection('users').doc(uid).update({
          organizationId: orgId, orgRole: 'admin', updatedAt: now,
        });
        return res.status(200).json({ orgId });
      }

      case 'invite': {
        const { orgId, email, role } = req.body;
        if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'Missing orgId' });
        if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Missing email' });
        if (role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Invalid role' });

        const membership = await getOrgMembership(adminDb, orgId, auth.uid);
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'You must be an admin to invite members' });
        }

        const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
        if (!orgSnap.exists) return res.status(404).json({ error: 'Organization not found' });
        const orgData = orgSnap.data()!;
        const seatLimit = orgData.seatLimit || 5;

        const membersSnap = await adminDb.collection('organizations').doc(orgId).collection('members').get();
        const pendingInvitesSnap = await adminDb.collection('organizations').doc(orgId).collection('invites')
          .where('status', '==', 'pending').get();
        if (membersSnap.size + pendingInvitesSnap.size >= seatLimit) {
          return res.status(400).json({ error: `Seat limit reached (${seatLimit}).` });
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
        return res.status(200).json({ code, inviteUrl: `${origin}/invite/${code}` });
      }

      case 'accept-invite': {
        const { code } = req.body;
        if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' });

        const normalizedCode = code.trim().toUpperCase();
        const invitesSnap = await adminDb.collectionGroup('invites')
          .where('code', '==', normalizedCode)
          .limit(1)
          .get();
        if (invitesSnap.empty) return res.status(404).json({ error: 'Invalid invite code' });

        const inviteDoc = invitesSnap.docs[0];
        const invite = inviteDoc.data();
        if (invite.status !== 'pending') {
          return res.status(400).json({ error: `This invite has already been ${invite.status}` });
        }

        const orgRef = inviteDoc.ref.parent.parent!;
        const orgId = orgRef.id;

        const userRef = adminDb.collection('users').doc(auth.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).json({ error: 'User not found' });
        const userData = userSnap.data()!;
        if (userData.organizationId && userData.organizationId !== orgId) {
          return res.status(400).json({ error: 'You are already a member of another organization. Leave it first.' });
        }

        const orgSnap = await orgRef.get();
        if (!orgSnap.exists) return res.status(404).json({ error: 'Organization not found' });
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
      }

      case 'remove-member': {
        const { orgId, uid } = req.body;
        if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'Missing orgId' });
        if (!uid || typeof uid !== 'string') return res.status(400).json({ error: 'Missing uid' });

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
      }

      case 'update-role': {
        const { orgId, uid, role } = req.body;
        if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'Missing orgId' });
        if (!uid || typeof uid !== 'string') return res.status(400).json({ error: 'Missing uid' });
        if (role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Invalid role' });

        const membership = await getOrgMembership(adminDb, orgId, auth.uid);
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'You must be an admin to change roles' });
        }
        if (role === 'member' && await isOrgOwner(adminDb, orgId, uid)) {
          return res.status(400).json({ error: 'Cannot demote the organization owner' });
        }

        const orgRef = adminDb.collection('organizations').doc(orgId);
        await orgRef.collection('members').doc(uid).update({ role });
        await adminDb.collection('users').doc(uid).update({
          orgRole: role,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ success: true });
      }

      case 'revoke-invite': {
        const { orgId, code } = req.body;
        if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'Missing orgId' });
        if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' });

        const membership = await getOrgMembership(adminDb, orgId, auth.uid);
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'You must be an admin to revoke invites' });
        }
        await adminDb.collection('organizations').doc(orgId).collection('invites').doc(code).update({
          status: 'revoked',
        });
        return res.status(200).json({ success: true });
      }

      case 'update-settings': {
        const { orgId, claimsEnabled } = req.body;
        if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'Missing orgId' });
        if (typeof claimsEnabled !== 'boolean') return res.status(400).json({ error: 'claimsEnabled must be a boolean' });

        const membership = await getOrgMembership(adminDb, orgId, auth.uid);
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({ error: 'You must be an admin to change team settings' });
        }
        await adminDb.collection('organizations').doc(orgId).update({
          claimsEnabled,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`Org endpoint error (action=${action}):`, err);
    return res.status(500).json({ error: err.message || 'Operation failed' });
  }
}
