# Cura.Tor go-live checklist

**Audience:** Earl  
**Goal:** Ship a honest paid beta after Phase A merges — billing works, trust surfaces are real, landing is public.  
**Do not** bulk-merge; rebase each PR onto `main` after the previous lands. Full sequence: `docs/pr-merge-order.md`.

---

## 1. Merge order — Phase A only

Merge **one at a time**, then smoke the critical path before the next:

| Order | PR | What it unlocks |
|------:|----|-----------------|
| 1 | **#1** Operator runbook | Ops docs / TECHNICAL_SPEC correction |
| 2 | **#4** Stripe lifecycle | Webhook → `users.tier` + secured checkout/portal |
| 3 | **#5** Trust / Auth / Home | Offline honesty, Legal baseline, support email text |
| 4 | **#35** Password reset | Auth forgot-password via `sendPasswordResetEmail` |
| 5 | **#33** Legal subprocessors | Privacy AI path + Gemini/Vision/Stripe/Firebase/Vercel |
| 6 | **#40** B2B DPA stub | DPA template + Legal links — after #33 |
| 7 | **#24** Landing + accuracy gallery + nav | Public landing, `/accuracy`, nav/footer links — **includes #3 + #21** |
| 8 | **#38** Landing SEO meta | Title/description/OG for Landing + Accuracy — **after #24** (PR base is #24 branch) |
| 9 | **#2** Critical-path tests | Vitest / RTL; aligns with webhook contract |
| 10 | **#43** Playwright smokes | Mocked e2e auth → scan → save → export — after #2 |
| 11 | **#32** Webhook fixture tests | Vitest coverage for Stripe lifecycle events (after #4/#2) |
| 12 | **#6** Accuracy + monitoring scaffold | Eval harness + observability hooks |

**After #6:** [#36](https://github.com/earlthepearl08/cura.tor/pull/36) expands the eval harness with a synthetic golden set (30 cards + 10 PH log sheets) plus `HOWTO-REAL-SAMPLES.md` for dropping real photos later. It can merge after #6 (eval-only; monitoring stays on #6).

**Accuracy stack:** Prefer merging **#24** only. It already contains landing (**#3**) and the gallery (**#21**). **Close #21** (and skip standalone **#3**) when #24 lands — do **not** merge #3+#21+#24 as three separate feature merges. Details: `docs/pr-merge-order.md`.

**Stop after Phase A** until Stripe webhook + smoke test (below) pass. Then continue P1 (#7–#11 are already ready for review).

---

## 2. Stripe webhook + Vercel secrets

After **#4** is on `main` and redeployed:

**Vercel → Project → Settings → Environment Variables** (Production + Preview as needed):

| Variable | Notes |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or test while validating) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the endpoint |
| `STRIPE_PIONEER_PRICE_IDS` | Comma-separated Pioneer monthly+yearly price IDs |
| `STRIPE_PRO_PRICE_IDS` | Comma-separated Pro monthly+yearly price IDs |
| `FIREBASE_PROJECT_ID` | Same project as client auth |
| `FIREBASE_CLIENT_EMAIL` | Service account |
| `FIREBASE_PRIVATE_KEY` | Full PEM; `\n` escapes OK in Vercel UI |
| `VITE_STRIPE_PUBLISHABLE_KEY` + `VITE_STRIPE_*_PRICE_ID` | Client checkout UI (already in `.env.example`) |

**Stripe Dashboard → Developers → Webhooks → Add endpoint**

- URL: `https://<prod-domain>/api/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET` → **redeploy**

- [ ] Test checkout (Pioneer or Pro) → Firestore `users/{uid}.tier` + `stripe.subscriptionStatus === 'active'`
- [ ] Settings success toast only after tier actually updates
- [ ] Cancel / portal still works for that customer

---

## 3. Firebase rules / indexes deploy

From repo root (Firebase CLI logged into the prod project):

```bash
firebase deploy --only firestore:rules
# When firestore.indexes.json exists on main (e.g. after event-workspaces work):
firebase deploy --only firestore:indexes
```

- [ ] `firestore.rules` matches what you intend to ship (claims rules change in later PRs — redeploy after those merge)
- [ ] No client permission errors on team Contacts / Admin after deploy
- [ ] Confirm project ID matches `VITE_FIREBASE_PROJECT_ID` / `FIREBASE_PROJECT_ID`

---

## 4. Google Sheets API + spreadsheets scope

Needed when **#8** (Sheets export) ships (P1 — already ready for review):

- [ ] Google Cloud Console → enable **Google Sheets API** (same project as Drive OAuth)
- [ ] OAuth consent screen → add scope `https://www.googleapis.com/auth/spreadsheets`
- [ ] `VITE_GOOGLE_CLIENT_ID` set in Vercel (same client as Drive sync)
- [ ] Authorized JS origins include prod domain + `http://localhost:5173`
- [ ] Smoke: Contacts → **Google Sheets** → spreadsheet opens with CRM headers

Details: `CRM_EXPORT_MAPPING.md` / `GOOGLE_DRIVE_SETUP.md` (Sheets section).

---

## 5. Sentry DSN env vars

Needed when **#22** (Sentry + funnel analytics) merges:

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SENTRY_DSN` | Vercel (client build) | Browser `@sentry/react` init — **no-op if unset** |
| `SENTRY_DSN` | Vercel (server) | Forward error/warn from `/api/error-log` |

- [ ] Create Sentry project; paste both DSNs; redeploy
- [ ] Without DSNs, app still runs (funnel logs via `/api/error-log` alone)
- [ ] With DSNs: trigger a test client error → appears in Sentry; funnel events stay breadcrumbs / info, not alert spam

See `MONITORING.md` on the observability branch.

---

## 6. Support email confirmation

Trust PR (**#5**) publishes **`support@curator-app.com`** in Legal (TODO wording removed). Password reset is **not** part of #5 — that is **#35**.

- [ ] Confirm this inbox exists and is monitored — **or** tell eng the real address before merge / follow-up commit
- [ ] Spot-check Legal + any Settings “support” copy after #5 lands

---

## 7. Accuracy sample photo drop-in

After **#24** (gallery + landing stack) is on `main`, SVG placeholders ship under `public/accuracy-samples/`. Before promoting accuracy publicly:

1. Drop real photos into `public/accuracy-samples/` next to placeholders, e.g.  
   `card-001-stacked-logo.jpg`, `card-002-multi-phone.jpg`,  
   `sheet-001-ph-signin.jpg`, `sheet-002-handwritten-mix.jpg`
2. In `src/data/accuracyGallery.ts`: set `imageSrc` + `imageIsPlaceholder: false`
3. Optionally sync `extracted` fields from `eval/accuracy/fixtures/.../expected.json`
4. Keep files small (~≤500KB); only publish images you have rights to use

- [ ] `/accuracy` shows real photos, not “placeholder” art
- [ ] Landing nav/footer → Accuracy samples works (comes with **#24**)

Details: `public/accuracy-samples/README.md` (on the #24 stack).

---

## 8. Post-merge smoke test

Run on **production** (or a Preview that has prod-like secrets) after Phase A:

**Public**

- [ ] `/` (or landing route) loads unauthenticated — pricing visible
- [ ] CTA → Auth works
- [ ] `/accuracy` (and `/legal`) load; support email looks correct

**Auth + core**

- [ ] Google sign-in and email/password (incl. password reset from **#35**)
- [ ] Single card scan → review → save → Contacts list
- [ ] Export CSV/Excel or vCard (Pioneer/Pro or access-code user)

**Billing**

- [ ] Checkout session opens only when signed in
- [ ] Pay test/live → webhook updates tier in Firestore within ~30s
- [ ] Settings reflects paid plan; portal opens

**Optional if those PRs already merged**

- [ ] Drive sync connect (Drive API + `drive.appdata`)
- [ ] Sheets export (Sheets API + `spreadsheets` scope)
- [ ] Log Sheet / Multi-Card (Pro) one happy path
- [ ] Sentry receives a forced test error

**Exit criteria:** Phase A merged, webhook green, support email confirmed, smoke list checked — then promote P1 reviews (#7–#11) deliberately per `docs/pr-merge-order.md`.
