# Event workspaces (lightweight show packs)

Temporary shared spaces for 2–10 people at one trade show. **Not** the enterprise org flow — any signed-in user can create or join with a short code.

## Product

| | Event pack | Enterprise team |
|---|------------|-----------------|
| Access | Create / join code (`EVT-XXXX`) | Admin invite / request approval |
| Seats | 2–10 | Seat limit from provisioning |
| Lifetime | 3–30 days (default 7), host can end early | Ongoing |
| Claims | Enabled by default | Org setting |
| Billing | **One-time** Stripe product (see below) | Enterprise SKU / request flow |

## Host capacity

```
hostLimit = min(10, FREE_HOST_SLOTS(1) + user.eventPackCredits)
```

- Joining events is always free (does not consume host capacity).
- Each successful Event pack Checkout increments `eventPackCredits` by 1 (extra concurrent host slot).
- Credits are **not** consumed when an event ends — they raise your concurrent host ceiling.

## Stripe Dashboard setup (Event pack)

Event pack is a **one-time payment**, not a Pioneer/Pro subscription.

1. Stripe Dashboard → **Products** → Add product  
   - Name: `Cura.Tor Event Pack`  
   - Description: One concurrent event-host slot (2–10 seats, short-lived show workspace)
2. Add a **one-time** Price (set your real amount in Dashboard — app does not invent a sell price)
3. Copy the `price_…` ID into env:
   - Client: `VITE_STRIPE_EVENT_PACK_PRICE_ID=price_…`
   - Server allowlist: `STRIPE_EVENT_PACK_PRICE_IDS=price_…` (comma-separated if multiple test/live)
4. Webhook endpoint: `https://<your-domain>/api/stripe-webhook`  
   - Minimum event: `checkout.session.completed`  
   - Signing secret → `STRIPE_WEBHOOK_SECRET`
5. Existing secrets still required: `STRIPE_SECRET_KEY`, Firebase Admin vars

Checkout uses `mode: 'payment'` with metadata `{ product: 'event_pack', firebaseUid }`.  
Success URL: `/events?payment=success`.

### Relationship to subscription billing

Pioneer/Pro remain **subscription** checkouts and tier updates on `users.tier`.  
Event pack does **not** change tier — only `eventPackCredits` / `eventPackPurchased`.

Fold the `product === 'event_pack'` branch into the single `api/stripe-webhook.ts` handler alongside subscription lifecycle events.

## Deploy

1. **Firestore rules + indexes**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Indexes:
   - `eventWorkspaces`: `hostId` ASC + `status` ASC
   - `eventWorkspaces`: `joinCode` ASC + `status` ASC

2. **API** — Vercel function `api/events.ts`. Requires existing Firebase Admin env:
   - `FIREBASE_PROJECT_ID` / `VITE_FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

3. **Stripe (Event pack)** — in addition to Pioneer/Pro subscription vars:

| Var | Purpose |
|-----|---------|
| `VITE_STRIPE_EVENT_PACK_PRICE_ID` | Client Checkout price |
| `STRIPE_EVENT_PACK_PRICE_IDS` | Server allowlist |
| `STRIPE_SECRET_KEY` | Checkout + webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |

## Data model

```
eventWorkspaces/{eventId}
  name, hostId, seatLimit, joinCode, claimsEnabled, expiresAt, status
  members/{uid}
  contacts/{contactId}   # same claim fields as org contacts
  folders/{folderId}
  batches/{batchId}

users/{uid}.eventIds[]   # membership list (Admin SDK)
users/{uid}.eventPackCredits   # extra concurrent host slots
users/{uid}.eventPackPurchased # lifetime packs bought
```

Client workspace modes: `personal` | `team` | `event` (`WorkspaceContext` + `teamStorage` root switch).
