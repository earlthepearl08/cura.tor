# Event workspaces (lightweight show packs)

Temporary shared spaces for 2–10 people at one trade show. **Not** the enterprise org flow — any signed-in user can create or join with a short code.

## Product

| | Event pack | Enterprise team |
|---|------------|-----------------|
| Access | Create / join code (`EVT-XXXX`) | Admin invite / request approval |
| Seats | 2–10 | Seat limit from provisioning |
| Lifetime | 3–30 days (default 7), host can end early | Ongoing |
| Claims | Enabled by default | Org setting |
| Billing | Product surface only — Stripe “Event pack” SKU is a follow-up | Enterprise SKU / request flow |

## Deploy

1. **Firestore rules + indexes**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Indexes:
   - `eventWorkspaces`: `hostId` ASC + `status` ASC
   - `eventWorkspaces`: `joinCode` ASC + `status` ASC

2. **API** — new Vercel function `api/events.ts` (still under Hobby’s 12-function cap with current set). Requires existing Firebase Admin env:
   - `FIREBASE_PROJECT_ID` / `VITE_FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

3. **No new Stripe env vars** for this PR. Wire an Event pack price later when SKUs exist.

## Data model

```
eventWorkspaces/{eventId}
  name, hostId, seatLimit, joinCode, claimsEnabled, expiresAt, status
  members/{uid}
  contacts/{contactId}   # same claim fields as org contacts
  folders/{folderId}
  batches/{batchId}

users/{uid}.eventIds[]   # membership list (Admin SDK)
```

Client workspace modes: `personal` | `team` | `event` (`WorkspaceContext` + `teamStorage` root switch).
