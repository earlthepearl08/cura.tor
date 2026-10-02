import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const EVENT_SEAT_MIN = 2;
const EVENT_SEAT_MAX = 10;
const EVENT_SEAT_DEFAULT = 5;
const DEFAULT_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 30;
/** Free concurrent host slots without a paid Event pack. */
const FREE_HOST_SLOTS = 1;
/** Absolute ceiling even with many packs. */
const MAX_ACTIVE_EVENTS_HOSTED = 10;

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

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `EVT-${segment()}`;
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value._seconds) return value._seconds * 1000;
  return 0;
}

function isEventWritable(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  if (data.status !== 'active') return false;
  const expiresAt = toMillis(data.expiresAt);
  return expiresAt > Date.now();
}

/**
 * Lightweight event workspaces (trade-show packs).
 * POST { action: 'create' | 'join' | 'leave' | 'end' | 'rotate-code' | 'list', ... }
 * Separate from enterprise orgs — no approval flow; short-lived shared space.
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
        const { name, seatLimit, durationDays } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Event name is required' });
        }
        if (name.trim().length > 80) {
          return res.status(400).json({ error: 'Event name must be 80 characters or less' });
        }

        const seats = typeof seatLimit === 'number' ? seatLimit : EVENT_SEAT_DEFAULT;
        if (!Number.isInteger(seats) || seats < EVENT_SEAT_MIN || seats > EVENT_SEAT_MAX) {
          return res.status(400).json({ error: `Seat limit must be ${EVENT_SEAT_MIN}–${EVENT_SEAT_MAX}` });
        }

        const days = typeof durationDays === 'number' ? durationDays : DEFAULT_DURATION_DAYS;
        if (!Number.isInteger(days) || days < 1 || days > MAX_DURATION_DAYS) {
          return res.status(400).json({ error: `Duration must be 1–${MAX_DURATION_DAYS} days` });
        }

        // Capacity = free slot(s) + purchased Event pack credits
        const userSnap = await adminDb.collection('users').doc(auth.uid).get();
        const userData = userSnap.data() || {};
        const packCredits = typeof userData.eventPackCredits === 'number' ? userData.eventPackCredits : 0;
        const hostLimit = Math.min(MAX_ACTIVE_EVENTS_HOSTED, FREE_HOST_SLOTS + packCredits);

        const hostedSnap = await adminDb.collection('eventWorkspaces')
          .where('hostId', '==', auth.uid)
          .where('status', '==', 'active')
          .get();
        const activeHosted = hostedSnap.docs.filter((d) => isEventWritable(d.data())).length;
        if (activeHosted >= hostLimit) {
          return res.status(400).json({
            error: packCredits > 0
              ? `You are hosting ${activeHosted}/${hostLimit} events. End one or buy another Event pack.`
              : 'Free host slot is in use. Buy an Event pack to host another show, or end your current event.',
            code: 'HOST_CAPACITY',
            activeHosted,
            hostLimit,
            eventPackCredits: packCredits,
          });
        }

        const email = auth.email || '';
        const displayName = auth.name || email.split('@')[0] || 'Host';
        const eventRef = adminDb.collection('eventWorkspaces').doc();
        const eventId = eventRef.id;
        const now = Date.now();
        const expiresAt = now + days * 24 * 60 * 60 * 1000;
        let joinCode = generateJoinCode();

        // Ensure join code uniqueness (retry a few times)
        for (let i = 0; i < 5; i++) {
          const existing = await adminDb.collection('eventWorkspaces')
            .where('joinCode', '==', joinCode)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          if (existing.empty) break;
          joinCode = generateJoinCode();
        }

        await eventRef.set({
          name: name.trim(),
          hostId: auth.uid,
          seatLimit: seats,
          joinCode,
          claimsEnabled: true,
          expiresAt,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        await eventRef.collection('members').doc(auth.uid).set({
          uid: auth.uid,
          email,
          displayName,
          role: 'host',
          joinedAt: now,
        });

        const userRef = adminDb.collection('users').doc(auth.uid);
        await userRef.set({
          eventIds: FieldValue.arrayUnion(eventId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return res.status(200).json({
          eventId,
          joinCode,
          expiresAt,
          name: name.trim(),
          seatLimit: seats,
        });
      }

      case 'join': {
        const { code } = req.body;
        if (!code || typeof code !== 'string') {
          return res.status(400).json({ error: 'Join code is required' });
        }
        const normalized = code.trim().toUpperCase();

        const eventsSnap = await adminDb.collection('eventWorkspaces')
          .where('joinCode', '==', normalized)
          .limit(5)
          .get();
        const eventDoc = eventsSnap.docs.find((d) => isEventWritable(d.data()));
        if (!eventDoc) {
          return res.status(404).json({ error: 'Invalid or expired event code' });
        }

        const eventId = eventDoc.id;
        const eventData = eventDoc.data();
        const memberRef = eventDoc.ref.collection('members').doc(auth.uid);
        const existingMember = await memberRef.get();
        if (existingMember.exists) {
          // Already a member — just ensure user.eventIds includes it
          await adminDb.collection('users').doc(auth.uid).set({
            eventIds: FieldValue.arrayUnion(eventId),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return res.status(200).json({
            eventId,
            name: eventData.name,
            alreadyMember: true,
            expiresAt: toMillis(eventData.expiresAt),
          });
        }

        const membersSnap = await eventDoc.ref.collection('members').get();
        if (membersSnap.size >= (eventData.seatLimit || EVENT_SEAT_DEFAULT)) {
          return res.status(400).json({ error: 'This event is full' });
        }

        const email = auth.email || '';
        const userSnap = await adminDb.collection('users').doc(auth.uid).get();
        const displayName = auth.name
          || userSnap.data()?.displayName
          || email.split('@')[0]
          || 'Member';
        const now = Date.now();

        await memberRef.set({
          uid: auth.uid,
          email,
          displayName,
          role: 'member',
          joinedAt: now,
        });
        await adminDb.collection('users').doc(auth.uid).set({
          eventIds: FieldValue.arrayUnion(eventId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return res.status(200).json({
          eventId,
          name: eventData.name,
          alreadyMember: false,
          expiresAt: toMillis(eventData.expiresAt),
        });
      }

      case 'leave': {
        const { eventId } = req.body;
        if (!eventId || typeof eventId !== 'string') {
          return res.status(400).json({ error: 'Missing eventId' });
        }

        const eventRef = adminDb.collection('eventWorkspaces').doc(eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
        const eventData = eventSnap.data()!;

        if (eventData.hostId === auth.uid) {
          return res.status(400).json({ error: 'Hosts cannot leave — end the event instead' });
        }

        const memberRef = eventRef.collection('members').doc(auth.uid);
        if (!(await memberRef.get()).exists) {
          return res.status(400).json({ error: 'You are not a member of this event' });
        }

        await memberRef.delete();
        await adminDb.collection('users').doc(auth.uid).set({
          eventIds: FieldValue.arrayRemove(eventId),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return res.status(200).json({ success: true });
      }

      case 'end': {
        const { eventId } = req.body;
        if (!eventId || typeof eventId !== 'string') {
          return res.status(400).json({ error: 'Missing eventId' });
        }

        const eventRef = adminDb.collection('eventWorkspaces').doc(eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
        const eventData = eventSnap.data()!;
        if (eventData.hostId !== auth.uid) {
          return res.status(403).json({ error: 'Only the host can end this event' });
        }

        await eventRef.update({
          status: 'ended',
          updatedAt: Date.now(),
        });

        return res.status(200).json({ success: true });
      }

      case 'rotate-code': {
        const { eventId } = req.body;
        if (!eventId || typeof eventId !== 'string') {
          return res.status(400).json({ error: 'Missing eventId' });
        }

        const eventRef = adminDb.collection('eventWorkspaces').doc(eventId);
        const eventSnap = await eventRef.get();
        if (!eventSnap.exists) return res.status(404).json({ error: 'Event not found' });
        const eventData = eventSnap.data()!;
        if (eventData.hostId !== auth.uid) {
          return res.status(403).json({ error: 'Only the host can rotate the join code' });
        }
        if (!isEventWritable(eventData)) {
          return res.status(400).json({ error: 'Event is ended or expired' });
        }

        let joinCode = generateJoinCode();
        for (let i = 0; i < 5; i++) {
          const existing = await adminDb.collection('eventWorkspaces')
            .where('joinCode', '==', joinCode)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          if (existing.empty) break;
          joinCode = generateJoinCode();
        }

        await eventRef.update({ joinCode, updatedAt: Date.now() });
        return res.status(200).json({ joinCode });
      }

      case 'list': {
        const userSnap = await adminDb.collection('users').doc(auth.uid).get();
        const userData = userSnap.data() || {};
        const eventIds: string[] = userData.eventIds || [];
        const packCredits = typeof userData.eventPackCredits === 'number' ? userData.eventPackCredits : 0;
        const hostLimit = Math.min(MAX_ACTIVE_EVENTS_HOSTED, FREE_HOST_SLOTS + packCredits);

        const events = [];
        // Firestore getAll in chunks of 10
        for (let i = 0; i < eventIds.length; i += 10) {
          const chunk = eventIds.slice(i, i + 10);
          const refs = chunk.map((id) => adminDb.collection('eventWorkspaces').doc(id));
          const snaps = await adminDb.getAll(...refs);
          for (const snap of snaps) {
            if (!snap.exists) continue;
            const d = snap.data()!;
            events.push({
              id: snap.id,
              name: d.name,
              hostId: d.hostId,
              seatLimit: d.seatLimit,
              joinCode: d.hostId === auth.uid ? d.joinCode : undefined,
              claimsEnabled: d.claimsEnabled !== false,
              expiresAt: toMillis(d.expiresAt),
              status: d.status,
              createdAt: toMillis(d.createdAt),
              updatedAt: toMillis(d.updatedAt),
              isHost: d.hostId === auth.uid,
              writable: isEventWritable(d),
            });
          }
        }

        events.sort((a, b) => b.createdAt - a.createdAt);
        const activeHosted = events.filter((e) => e.isHost && e.writable).length;
        return res.status(200).json({
          events,
          capacity: {
            freeHostSlots: FREE_HOST_SLOTS,
            eventPackCredits: packCredits,
            hostLimit,
            activeHosted,
          },
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`Events endpoint error (action=${action}):`, err);
    return res.status(500).json({ error: err.message || 'Operation failed' });
  }
}
