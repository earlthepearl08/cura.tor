# HubSpot CRM connector (Cura.Tor)

Lightweight server-side stub that upserts contacts into HubSpot from the in-app
**Contacts → Export → Export to HubSpot** menu (also documented under Settings).

Tier gate: **Pioneer / Pro / Enterprise** — same paid export family as CSV (`canExportCSV` / `TIER_LIMITS.csvExport`).

Field mapping reuses `src/services/crmExport.ts` (shared with the CRM-ready CSV / Google Sheets path from PR #8).

## Environment variables

### Required for live export (private app — preferred)

| Variable | Where | Notes |
|----------|--------|--------|
| `HUBSPOT_ACCESS_TOKEN` | Vercel / server only (**no** `VITE_` prefix) | Private app access token with contact write scopes |

If this token is missing, `/api/hubspot-export` returns **503** with a setup checklist instead of calling HubSpot.

### Optional OAuth (future / not required for this stub)

Documented for a per-user OAuth path; the current stub does **not** exchange these yet.

| Variable | Notes |
|----------|--------|
| `HUBSPOT_CLIENT_ID` | HubSpot app client id |
| `HUBSPOT_CLIENT_SECRET` | HubSpot app client secret (server only) |
| `HUBSPOT_REFRESH_TOKEN` | Offline refresh token if using a single shared OAuth install |

Also required for auth (already used by other APIs):

| Variable | Notes |
|----------|--------|
| `FIREBASE_PROJECT_ID` or `VITE_FIREBASE_PROJECT_ID` | JWT audience / issuer for Firebase ID tokens |

## Private app setup

1. HubSpot → **Settings → Integrations → Private Apps** → Create app.
2. Scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.notes.write` (optional — Notes / Folder / Batch metadata)
3. Copy the access token → set `HUBSPOT_ACCESS_TOKEN` in Vercel (Production + Preview as needed).
4. Redeploy. Open Cura.Tor → Contacts → Export → **Export to HubSpot**.

## Property mapping

| CRM-ready column (`crmExport`) | HubSpot property |
|--------------------------------|------------------|
| First Name | `firstname` |
| Last Name | `lastname` (fallback: first name or `Unknown`) |
| Email | `email` (upsert identity when present) |
| Phone | `phone` |
| Mobile Phone | `mobilephone` |
| Company Name | `company` |
| Job Title | `jobtitle` |
| Street Address | `address` |
| Lifecycle Stage | `lifecyclestage` (`lead`) |
| Notes, Additional Emails, Lead Source, Folder, Batch, Claimed By, Contact ID, Scanned At | Note engagement body (`hs_note_body`) when notes scope is available |

Contacts **with email** use HubSpot **batch upsert** (`idProperty=email`). Contacts without email use **batch create**.

## API

`POST /api/hubspot-export`

- Auth: `Authorization: Bearer <Firebase ID token>`
- Body: `{ contacts: [{ properties: Record<string,string>, noteBody?: string }] }`
- Success: `{ ok, created, updated, notesCreated, errors? }`
- Not configured: `503` + `{ code: "hubspot_not_configured", setup: [...] }`

Client helper: `src/services/hubspot.ts` → `exportContactsToHubSpot()`.

## Support

Questions: [support@curator-app.com](mailto:support@curator-app.com)
