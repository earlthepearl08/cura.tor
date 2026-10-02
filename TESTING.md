# Testing (Cura.Tor)

Critical-path automated tests use **Vitest + React Testing Library** with stable mocks (no live Gemini, OCR, Stripe, or Firebase). E2E smokes use **Playwright** with mocked auth and Gemini.

## Quick start (unit)

```bash
npm install
npm test
```

**GitHub Actions:** `.github/workflows/vitest.yml` runs `npm ci` → `npm test` on every PR.

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

## E2E smoke (Playwright)

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

**GitHub Actions:** `.github/workflows/playwright-e2e.yml` runs the same command on every PR (`npm ci` → Chromium → `npm run test:e2e`).

Details: [`e2e/README.md`](./e2e/README.md).

Happy path: **auth (mock) → upload/scan (mocked Gemini) → save → CSV export** — no live Gemini/Stripe.

## What is covered (P0)

| Area | Location | Notes |
|------|----------|--------|
| Auth gate | `src/components/ProtectedRoute.test.tsx` | Loading, redirect to `/auth`, email verification block, happy path |
| Scan → save → export | `src/services/scanSaveExport.flow.test.ts` | `ocrService.processImage` mocked; IndexedDB via `fake-indexeddb`; CSV export |
| Export unit | `src/services/export.test.ts` | CSV download + vCard serialization |
| Stripe webhook → tier | `api/__tests__/stripe-webhook.contract.test.ts` | Fixtures in `tests/fixtures/stripe/`; contract in `api/lib/stripeWebhookContract.ts` |
| E2E happy path | `e2e/*.spec.ts` | Mock auth + mocked OCR APIs |

## PR checklist

1. Run `npm test` locally (or in CI) before requesting review.
2. Do **not** point tests at production Gemini / Vision / Stripe — keep mocks/fixtures.
3. If you change Checkout metadata (`firebaseUid`, `tier`) or Firestore `users.tier` / `users.stripe` shapes, update contract helpers and fixture tests.
4. When changing auth or scan flows, keep Playwright smokes green with mocks.

## Design notes

- **Vitest** matches the Vite + React toolchain.
- Playwright complements Vitest with a mocked end-to-end path; prefer mocks over live e2e against production APIs.
- The Stripe suite tests the **Firestore patch contract**, not a live webhook HTTP handler.
