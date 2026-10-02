import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const HUBSPOT_API = 'https://api.hubapi.com';
const BATCH_SIZE = 100;
/** HubSpot-defined association: note → contact */
const NOTE_TO_CONTACT_ASSOCIATION = 202;

type AuthOk = { ok: true; uid: string; email: string | null };
type AuthFail = { ok: false; reason: string };

export interface HubSpotContactInput {
  /** HubSpot CRM properties (firstname, lastname, email, …) */
  properties: Record<string, string>;
  /** Optional note body (Notes + Cura.Tor metadata) */
  noteBody?: string;
}

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
    const email = typeof (payload as { email?: unknown }).email === 'string'
      ? (payload as { email: string }).email
      : null;
    return { ok: true, uid, email };
  } catch (err: any) {
    return { ok: false, reason: `jwt-${err?.code || err?.message || 'unknown'}` };
  }
}

function setupErrorResponse() {
  return {
    error: 'HubSpot is not configured on this server',
    code: 'hubspot_not_configured',
    setup: [
      'Create a HubSpot private app with crm.objects.contacts.write (and crm.objects.contacts.read for upsert).',
      'Optionally add crm.objects.notes.write if you want Notes synced.',
      'Set HUBSPOT_ACCESS_TOKEN to the private-app access token in Vercel env (server-only).',
      'For a future OAuth path, see HUBSPOT.md (HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET / HUBSPOT_REFRESH_TOKEN).',
      'Redeploy after setting the token, then use Contacts → Export → Export to HubSpot.',
    ],
    docs: 'HUBSPOT.md',
  };
}

async function hubspotFetch(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Lightweight HubSpot CRM connector stub.
 * POST { contacts: HubSpotContactInput[] }
 *
 * When HUBSPOT_ACCESS_TOKEN is set: upserts contacts by email (creates when no email).
 * When missing: returns a clear setup error (see HUBSPOT.md).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Unauthorized', reason: auth.reason });
  }

  const accessToken = (process.env.HUBSPOT_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    return res.status(503).json(setupErrorResponse());
  }

  const contacts = Array.isArray(req.body?.contacts) ? (req.body.contacts as HubSpotContactInput[]) : null;
  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'Missing required field: contacts (non-empty array)' });
  }
  if (contacts.length > 500) {
    return res.status(400).json({ error: 'Too many contacts in one request (max 500). Export in smaller batches.' });
  }

  const withEmail: HubSpotContactInput[] = [];
  const withoutEmail: HubSpotContactInput[] = [];
  for (const c of contacts) {
    if (!c?.properties || typeof c.properties !== 'object') continue;
    const email = (c.properties.email || '').trim();
    if (email) withEmail.push(c);
    else withoutEmail.push(c);
  }

  let created = 0;
  let updated = 0;
  let notesCreated = 0;
  const errors: string[] = [];
  /** contact hubspot id → noteBody */
  const noteJobs: { hubspotId: string; noteBody: string }[] = [];

  try {
    for (const batch of chunk(withEmail, BATCH_SIZE)) {
      const payload = {
        inputs: batch.map((c) => ({
          idProperty: 'email',
          id: c.properties.email.trim(),
          properties: Object.fromEntries(
            Object.entries(c.properties).filter(([, v]) => v != null && String(v).trim() !== '')
          ),
        })),
      };
      const result = await hubspotFetch('/crm/v3/objects/contacts/batch/upsert', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        const msg = result.data?.message || result.data?.error || `HubSpot upsert failed (${result.status})`;
        errors.push(String(msg));
        continue;
      }
      const results = Array.isArray(result.data?.results) ? result.data.results : [];
      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const newFlag = row?.new === true || row?.createdAt === row?.updatedAt;
        if (newFlag) created += 1;
        else updated += 1;
        const noteBody = batch[i]?.noteBody?.trim();
        if (noteBody && row?.id) {
          noteJobs.push({ hubspotId: String(row.id), noteBody });
        }
      }
    }

    for (const batch of chunk(withoutEmail, BATCH_SIZE)) {
      const payload = {
        inputs: batch.map((c) => ({
          properties: Object.fromEntries(
            Object.entries(c.properties).filter(([, v]) => v != null && String(v).trim() !== '')
          ),
        })),
      };
      const result = await hubspotFetch('/crm/v3/objects/contacts/batch/create', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        const msg = result.data?.message || result.data?.error || `HubSpot create failed (${result.status})`;
        errors.push(String(msg));
        continue;
      }
      const results = Array.isArray(result.data?.results) ? result.data.results : [];
      created += results.length;
      for (let i = 0; i < results.length; i++) {
        const noteBody = batch[i]?.noteBody?.trim();
        if (noteBody && results[i]?.id) {
          noteJobs.push({ hubspotId: String(results[i].id), noteBody });
        }
      }
    }

    // Best-effort notes (do not fail the whole export if notes scope is missing)
    for (const job of noteJobs) {
      const noteRes = await hubspotFetch('/crm/v3/objects/notes', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          properties: {
            hs_timestamp: String(Date.now()),
            hs_note_body: job.noteBody,
          },
          associations: [
            {
              to: { id: job.hubspotId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: NOTE_TO_CONTACT_ASSOCIATION,
                },
              ],
            },
          ],
        }),
      });
      if (noteRes.ok) notesCreated += 1;
    }

    if (created === 0 && updated === 0 && errors.length > 0) {
      return res.status(502).json({
        error: 'HubSpot API rejected the export',
        details: errors.slice(0, 5),
        created,
        updated,
        notesCreated,
      });
    }

    return res.status(200).json({
      ok: true,
      created,
      updated,
      notesCreated,
      skipped: contacts.length - withEmail.length - withoutEmail.length,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    console.error('HubSpot export failed:', err);
    return res.status(500).json({
      error: err?.message || 'HubSpot export failed',
      code: 'hubspot_export_failed',
    });
  }
}
