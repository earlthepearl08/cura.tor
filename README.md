# Cura.Tor — Operator Runbook

Engineering ops for **calling-card-scanner** / Cura.Tor (React + Vite PWA on Vercel, Firebase Auth/Firestore, Gemini/Vision OCR, Stripe billing).

Related: [`VERCEL_SETUP.md`](./VERCEL_SETUP.md) · [`GOOGLE_DRIVE_SETUP.md`](./GOOGLE_DRIVE_SETUP.md) · [`.env.example`](./.env.example) · [`TECHNICAL_SPEC.md`](./TECHNICAL_SPEC.md) (historical — see warning there)

---

## Quick start (local)

```bash
cp .env.example .env   # fill values below
npm install
npm run dev            # Vite → http://localhost:5173
```

API routes under `api/` need Vercel (or `vercel dev`) to exercise serverless handlers locally.

---

## Environment variables

### Client (`VITE_*` — baked into the browser bundle)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase / Firestore project |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app id |
| `VITE_GOOGLE_CLIENT_ID` | For Drive sync | OAuth client for Google Drive App Data |
| `VITE_STRIPE_PUBLISHABLE_KEY` | For checkout UI | Stripe publishable key |
| `VITE_STRIPE_PIONEER_MONTHLY_PRICE_ID` | For Pioneer | Stripe Price id |
| `VITE_STRIPE_PIONEER_YEARLY_PRICE_ID` | For Pioneer | Stripe Price id |
| `VITE_STRIPE_PRO_MONTHLY_PRICE_ID` | For Pro | Stripe Price id |
| `VITE_STRIPE_PRO_YEARLY_PRICE_ID` | For Pro | Stripe Price id |

### Server (Vercel env — **never** `VITE_` prefix)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes (OCR) | Gemini 2.5 Flash via `/api/gemini` |
| `GOOGLE_API_KEY` | Alt / Vision | Cloud Vision via `/api/ocr`; also accepted as Gemini fallback |
| `FIREBASE_PROJECT_ID` | Yes (APIs) | JWT audience + Admin SDK (falls back to `VITE_FIREBASE_PROJECT_ID`) |
| `FIREBASE_CLIENT_EMAIL` | Yes (Admin) | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes (Admin) | PEM key; use `\n` newlines in Vercel UI |
| `STRIPE_SECRET_KEY` | For billing | Checkout + Customer Portal |
| `STRIPE_WEBHOOK_SECRET` | For fulfillment | Signing secret for webhook endpoint (**endpoint not in repo yet**) |
| `STRIPE_PIONEER_PRICE_IDS` | Webhook mapping | Comma-separated Pioneer price ids (when webhook ships) |
| `STRIPE_PRO_PRICE_IDS` | Webhook mapping | Comma-separated Pro price ids (when webhook ships) |
| `OWNER_EMAILS` | Optional | Comma-separated owner emails (default: `earldy.kinmo@gmail.com`) |
| `APP_URL` | Optional | Public origin fallback (e.g. org invite links) |

**Checklist — secrets**

- [ ] Copy `.env.example` → `.env` locally; never commit secrets
- [ ] Set the same keys in Vercel → Project → Settings → Environment Variables (Production + Preview as needed)
- [ ] `FIREBASE_PRIVATE_KEY`: paste full PEM; if Vercel stores literal `\n`, code already unescapes them
- [ ] Redeploy after changing env vars

---

## Vercel deploy

**Target project:** `cura-tor` (typical prod URL: `https://cura-tor.vercel.app`)

**Checklist — ship**

- [ ] Repo connected; root is this package (`vercel.json` rewrites SPA → `/index.html`, leaves `/api/*` alone)
- [ ] Build: `npm run build` (`tsc && vite build`)
- [ ] All server + `VITE_*` env vars set (table above)
- [ ] Deploy via git push to the linked branch, or Vercel Dashboard → Deploy
- [ ] Smoke: `/auth` loads · signed-in scan hits `/api/gemini` without 500 · Settings upgrade buttons present if Stripe keys set

**Local API:** `npx vercel dev` (uses Vercel env / `.env`). Plain `npm run dev` serves the SPA only.

Details for Gemini-only setup: [`VERCEL_SETUP.md`](./VERCEL_SETUP.md).

---

## Firebase (Auth, Firestore, rules)

**Client config:** `src/config/firebase.ts` reads `VITE_FIREBASE_*`.

**Admin SDK:** used by `api/gemini.ts`, `api/ocr.ts`, `api/account.ts`, `api/org.ts`, `api/check-tier-expiry.ts`, `api/admin/*` for tier/quota and owner actions.

**Rules file:** `firestore.rules` · declared in `firebase.json`.

**Checklist — rules deploy**

```bash
# requires Firebase CLI + project access
npm i -g firebase-tools   # once
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules
```

- [ ] Confirm Auth providers enabled (Google + Email/Password) in Firebase Console
- [ ] Deploy rules after any `firestore.rules` change — **before** relying on new security assumptions in prod
- [ ] Service account: Console → Project Settings → Service Accounts → Generate private key → map to `FIREBASE_*` on Vercel

---

## Gemini / Cloud Vision keys

| Path | Key | Role |
|------|-----|------|
| `/api/gemini` | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Primary card / multi-card / log-sheet extraction |
| `/api/ocr` | `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) | Cloud Vision proxy |
| Client Tesseract | none | Fallback / offline-ish path in Settings OCR engine |

**Checklist — AI keys**

- [ ] Create key at [Google AI Studio](https://aistudio.google.com/apikey) (Gemini) and/or Google Cloud (Vision)
- [ ] Set on Vercel as **server-only** (no `VITE_` prefix)
- [ ] Prefer **paid** Google billing before promoting Pro log-sheet scans (free quotas will 429 under load)
- [ ] Confirm authenticated scan returns structured fields (not key-missing 500)

---

## Stripe (checkout + webhook)

**In repo today**

- Checkout: `api/create-checkout.ts` → Stripe Checkout (subscription)
- Portal: `api/create-portal.ts`
- Client prices: `src/services/stripe.ts` + `VITE_STRIPE_*_PRICE_ID`

**Missing (P0)**

- No `api/stripe-webhook.ts` in this tree. Checkout can collect payment; **nothing in-repo writes `users.tier` / `stripe.*` on success, renew, fail, or cancel.** Settings “Payment successful” after redirect is **not** proof of fulfillment.
- Comments in `api/gemini.ts` / `api/ocr.ts` mention a webhook file historically; treat fulfillment as **unimplemented until the handler exists and is verified**.

**Checklist — Stripe products**

- [ ] Create Products/Prices in Stripe (Pioneer + Pro, monthly + yearly)
- [ ] Mirror Price ids into `VITE_STRIPE_*_PRICE_ID` and (for webhook mapping) `STRIPE_PIONEER_PRICE_IDS` / `STRIPE_PRO_PRICE_IDS`
- [ ] Set `STRIPE_SECRET_KEY` + `VITE_STRIPE_PUBLISHABLE_KEY` (test keys first)

**Checklist — webhook (when `api/stripe-webhook.ts` ships)**

- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint: `https://<prod-host>/api/stripe-webhook`
- [ ] Events (minimum): `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy; run a test Checkout; confirm Firestore `users/{uid}.tier` and `stripe` fields update **before** trusting the success toast
- [ ] Local: `stripe listen --forward-to localhost:3000/api/stripe-webhook` (or your `vercel dev` port)

**Known gaps to remember while operating**

- Checkout/portal handlers do **not** verify Firebase JWT today
- Account delete has `TODO(stripe)` — subscription cancel not wired

---

## Owner admin usage

**Who is owner**

1. **Client gate:** `OWNER_EMAILS` in `src/config/firebase.ts` (hardcoded list; owners auto-elevated toward Pro in `userService`)
2. **Server gate:** `OWNER_EMAILS` env (comma-separated) on admin APIs — keep **in sync** with the client list

**UI:** Settings → Admin Panel (`/admin`) — only visible/usable for owner emails.

**Capabilities**

| Action | API | Notes |
|--------|-----|-------|
| Grant trial (Pioneer/`early_access` or Pro) | `POST /api/admin/grant-trial` | Needs target Firebase **UID**; user must have signed in once |
| List / approve / reject enterprise requests | `/api/admin/enterprise-requests` (+ provision) | Approve sets seat limit / provisions org |

**Checklist — grant a trial**

- [ ] User signs up once (creates `users/{uid}`)
- [ ] Copy their Firebase Auth UID (Console → Authentication, or Firestore `users` doc id)
- [ ] Sign in as owner → Settings → Admin Panel → Grant Trial Access
- [ ] Set tier, optional scan/contact limits (blank = unlimited), expiry date → Grant
- [ ] User refreshes / reopens app; tier should show until `expiresAt` (`/api/check-tier-expiry` downgrades when past)

**Checklist — enterprise request**

- [ ] Owner opens Admin → filter **pending**
- [ ] Approve with seat limit, or Reject with reason
- [ ] Confirm org + member tier in Firestore after approve

**Owner account delete:** blocked by `/api/account` while email remains in `OWNER_EMAILS`.

---

## Post-deploy smoke checklist

- [ ] Auth: Google + email/password
- [ ] Single-card scan (Gemini path)
- [ ] Export CSV/Excel (tier-gated as expected)
- [ ] Owner: `/admin` loads; non-owner redirected
- [ ] Stripe: Checkout session URL opens (fulfillment only after webhook exists)
- [ ] Firestore rules: non-owner cannot escalate `tier` via client write beyond allowed transitions

---

## Doc map

| Doc | Audience |
|-----|----------|
| **This README** | Operators / deploy |
| `VERCEL_SETUP.md` | Gemini key on Vercel |
| `GOOGLE_DRIVE_SETUP.md` | Drive OAuth client |
| `TECHNICAL_SPEC.md` | Early design notes — **outdated**; see banner at top |
| `.env.example` | Env template |
