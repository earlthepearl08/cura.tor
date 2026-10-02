# Testing (Cura.Tor)

Critical-path automated tests use **Vitest + React Testing Library** with stable mocks (no live Gemini, OCR, Stripe, or Firebase).

## Quick start

```bash
npm install
npm test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

## What is covered (P0)

| Area | Location | Notes |
|------|----------|--------|
| Auth gate | `src/components/ProtectedRoute.test.tsx` | Loading, redirect to `/auth`, email verification block, happy path |
| Scan → save → export | `src/services/scanSaveExport.flow.test.ts` | `ocrService.processImage` mocked; IndexedDB via `fake-indexeddb`; CSV export |
| Export unit | `src/services/export.test.ts` | CSV download + vCard serialization |
| Stripe webhook → tier | `api/__tests__/stripe-webhook.contract.test.ts` | Fixtures in `tests/fixtures/stripe/`; contract in `api/lib/stripeWebhookContract.ts` |

## PR checklist

1. Run `npm test` locally (or in CI) before requesting review.
2. Do **not** point tests at production Gemini / Vision / Stripe — keep mocks/fixtures.
3. If you change Checkout metadata (`firebaseUid`, `tier`) or Firestore `users.tier` / `users.stripe` shapes, update:
   - `api/lib/stripeWebhookContract.ts`
   - `tests/fixtures/stripe/webhook-events.ts`
   - related contract tests
4. When `api/stripe-webhook.ts` lands, wire it through the contract helpers and keep these fixture tests green.

## Design notes

- **Vitest** matches the Vite + React toolchain (Jest was in the old spec; Vitest is the practical equivalent here).
- Playwright is not required for this P0 suite; prefer expanding Vitest/RTL with mocked APIs over flaky live e2e.
- The Stripe suite tests the **Firestore patch contract**, not a live webhook HTTP handler (file may still be missing on some branches).
