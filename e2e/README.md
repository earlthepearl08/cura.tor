# End-to-end smoke tests (Playwright)

CI-friendly happy-path scaffolding for **auth → scan → save → export**.  
Uses mocked Gemini/OCR/Stripe and an opt-in auth stub — **no live Gemini or Stripe**.

## Prerequisites

```bash
npm install
npx playwright install chromium
```

## Run

```bash
# Start Vite automatically (see playwright.config.ts webServer) and run smoke tests
npm run test:e2e
```

UI mode (local debugging):

```bash
npm run test:e2e:ui
```

## What is covered

| Spec | Path |
|------|------|
| `e2e/auth-gate.spec.ts` | Unauthenticated `/` → `/auth`; `/legal` stays public |
| `e2e/scan-save-export.spec.ts` | Mock auth → Upload → mocked Gemini OCR → save → CSV export |

## How mocks work

1. **Auth** — Playwright sets `localStorage.cura_e2e_mock_auth=1` before load. `AuthContext` seeds a Pro user and skips Firebase Auth (`src/e2e/mockAuthFlag.ts`).
2. **Gemini / OCR** — `page.route('**/api/gemini')` (and `/api/ocr`) return fixture JSON (`e2e/helpers/apiMocks.ts`).
3. **Stripe / Firebase REST** — checkout/portal and Google identity endpoints are stubbed so the UI never waits on real network.

Optional build-time flag: `VITE_E2E_MOCK_AUTH=true` (do **not** set this on production Vercel).

## CI notes

- Set `CI=true` so Playwright does not reuse an existing Vite server and uses a single worker.
- Install browsers in CI: `npx playwright install --with-deps chromium` (or `chromium` only on pre-provisioned images).
- These tests complement Vitest unit/critical-path suites; they do not replace them.

## Fixture

- `e2e/fixtures/sample-card.png` — tiny PNG used as the upload input (OCR content comes from the Gemini mock, not the pixels).
