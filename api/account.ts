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

/**
 * Delete the caller's account server-side: clean up org membership,
 * revoke their pending invites, delete any enterpriseRequests they opened,
 * and delete their user doc. Owner emails are whitelisted — we don't want
 * to accidentally wipe the founder.
 *
 * The client completes the deletion by calling firebase/auth deleteUser()
 * after this endpoint returns 200. (We don't use firebase-admin/auth here
 * because it doesn't bundle correctly on this Vercel project.)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });

  if (isOwnerEmail(auth.email)) {
    return res.status(403).json({
      error: 'Owner accounts cannot be deleted through the app. Contact support or remove the email from OWNER_EMAILS first.',
    });
  }

  let adminDb: FirebaseFirestore.Firestore;
  try {
    adminDb = getAdminDb();
  } catch (err: any) {
    console.error('Firebase Admin init failed:', err.message);
    return res.status(500).json({ error: 'Server configuration error', details: err.message });
  }

  const uid = auth.uid;
  const userRef = adminDb.collection('users').doc(uid);

  try {
    const userSnap = await userRef.get();
    // If there's no user doc we can still let the client proceed to delete
    // the Firebase Auth record — nothing to clean up on our side.
    const userData = userSnap.exists ? userSnap.data()! : null;

    // --- Org cleanup ---
    if (userData?.organizationId) {
      const orgId = userData.organizationId;
      const orgRef = adminDb.collection('organizations').doc(orgId);
      const orgSnap = await orgRef.get();

      if (orgSnap.exists) {
        const orgData = orgSnap.data()!;
        const isOwner = orgData.ownerId === uid;

        if (isOwner) {
          // Count other members
          const membersSnap = await orgRef.collection('members').get();
          const others = membersSnap.docs.filter(d => d.id !== uid);
          if (others.length > 0) {
            return res.status(400).json({
              error: `You're the owner of ${orgData.name} and there are still ${others.length} other member(s). Transfer ownership or remove all members before deleting your account.`,
            });
          }
          // Sole-owner solo org: nuke the whole org
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
          // Member leaving — just remove their member doc
          await orgRef.collection('members').doc(uid).delete();
        }
      }
    }

    // --- Revoke invites sent by this user ---
    const sentInvitesSnap = await adminDb.collectionGroup('invites')
      .where('invitedBy', '==', uid)
      .where('status', '==', 'pending')
      .get();
    if (!sentInvitesSnap.empty) {
      const batch = adminDb.batch();
      sentInvitesSnap.docs.forEach(d => batch.update(d.ref, { status: 'revoked' }));
      await batch.commit();
    }

    // --- Delete any enterpriseRequests this user opened ---
    const requestsSnap = await adminDb.collection('enterpriseRequests')
      .where('uid', '==', uid).get();
    if (!requestsSnap.empty) {
      const batch = adminDb.batch();
      requestsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    // --- Delete the user doc itself ---
    if (userSnap.exists) {
      await userRef.delete();
    }

    // NOTE: Stripe subscription cancellation would go here once Stripe is wired.
    // TODO(stripe): cancel subscription for userData?.stripe?.subscriptionId

    return res.status(200).json({
      ok: true,
      message: 'Account data deleted. Firebase Auth deletion is happening client-side.',
    });
  } catch (err: any) {
    console.error('Account deletion error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to delete account',
      phase: 'server-cleanup',
    });
  }
}
