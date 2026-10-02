# Production monitoring (Cura.Tor)

Short operator checklist for **Gemini cost-per-scan**, **rate-limit / error alerts**, optional **Sentry**, and **product funnel analytics**. Complements the accuracy harness in `eval/accuracy/`.

## Required / optional env vars

| Variable | Where | Required? | Purpose |
|----------|--------|-----------|---------|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Vercel (server) | Yes for OCR | Gemini + Vision |
| `VITE_SENTRY_DSN` | Vercel / `.env` (client) | Optional | Enables `@sentry/react` init in `src/services/sentry.ts` |
| `SENTRY_DSN` | Vercel (server) | Optional | Forwards error/warn events from `/api/error-log` to Sentry store API |

Without Sentry DSNs the app still emits structured JSON logs and accepts `POST /api/error-log` (202). Sentry is additive.

Set both DSNs to the same Sentry project if you want client crashes + server-forwarded events in one place.

**Vercel tips**

- `VITE_*` vars must be present at **build** time for the client bundle.
- `SENTRY_DSN` is runtime-only on serverless functions.
- See also `VERCEL_SETUP.md` and `.env.example`.

## Cost per scan (estimate)

Model default: **Gemini 2.5 Flash** via `api/gemini.ts`.

| Flow | Typical input | Typical output | Rough cost band* |
|------|---------------|----------------|------------------|
| Single card | 1 image (~0.5–1.5 MP after compress) + short prompt | ~200–600 tokens JSON | Low cents / scan |
| Multi-card | 1 image, denser scene | ~0.5–2k tokens | ~2–4× single |
| Log sheet | 1 image (full page) | ~1–4k tokens (many rows) | Highest; watch 429s |

\*Confirm current Google AI Studio / Cloud pricing before ads spend. Re-check after prompt or `maxOutputTokens` changes.

**How to compute your real average**

1. Enable paid Google billing (free tier will throttle under Pro log-sheet load).
2. In Google AI / Cloud console, note monthly Gemini spend + request count for `gemini-2.5-flash`.
3. `cost_per_scan ≈ monthly_gemini_spend / successful_scan_count`  
   (scan count ≈ Firestore quota increments / Vercel `api/gemini` 200s).
4. Track separately: single vs multi vs log-sheet if you add a `flow` tag on logs (client already sends `flow` on failures via `/api/error-log`).

**Budget alerts to set (Google Cloud / AI Studio)**

- [ ] Billing budget at expected monthly Gemini spend (e.g. 50% / 90% / 100% email).
- [ ] Anomaly alert if daily spend > 2× trailing 7-day average.
- [ ] Cap or kill-switch plan if free-tier users spike scrapes (server rate limits already: 60/min, 600/h, 3000/day per uid in `api/gemini.ts`).

## Rate limits & HTTP health

| Signal | Source | Action |
|--------|--------|--------|
| **429** from Gemini upstream | Vercel logs `Gemini API error: 429`; client events `gemini_429` → `/api/error-log` | Check Google quota; backoff already 1s/2s/4s in `callGeminiWithRetry` |
| **429** app rate-limit / tier quota | `reason: rate-limit-*` or `quota-exceeded` | Expected for abuse/free tier; alert only if sustained spike across many uids |
| **5xx** Gemini or our proxy | `gemini_5xx` / Vercel function errors | Page on-call if error rate > ~5% of Gemini calls over 15 min |
| Scan failures (parse / empty) | `scan_failure` | Correlate with accuracy eval; prompt regression? |
| Client crashes | `client_error` from `ErrorBoundary` | Fix release; optional Sentry |

### Alert checklist (wire in your log drain / Sentry)

- [ ] Alert: count(`gemini_429`) > N in 15 minutes (start with N=20).
- [ ] Alert: count(`gemini_5xx`) > N in 15 minutes (start with N=10).
- [ ] Alert: count(`scan_failure`) / Gemini requests > 10% over 1 hour.
- [ ] Alert: Vercel `api/gemini` p95 duration > 60s.
- [ ] Weekly review: cost_per_scan vs tier pricing (Pioneer/Pro must remain margin-positive on log sheets).

## Product funnel analytics

Lightweight events via `trackEvent` → same `/api/error-log` intake at **info** level (logged as `src: cura.tor.api.analytics`, **no** alert noise, not forwarded to Sentry).

| Event | When | Context (no PII) |
|-------|------|------------------|
| `signup` | New Firestore user doc created (`getOrCreateUserDoc` isNew) | `method`: `google` \| `email`, `tier` |
| `first_scan` | First successful scan refresh (`lifetimeCount` 0→≥1) | `tier`, `lifetimeCount` |
| `upgrade_intent` | Upgrade CTA (prompt → Settings) or Settings checkout start | `source`, `plan`, `fromTier` / `interval` |
| `upgrade_success` | Stripe return confirmed active, or access-code redeem | `method`: `stripe_checkout` \| `access_code` |

**Query in Vercel logs**

```text
cura.tor.api.analytics
"name":"signup"
"name":"first_scan"
"name":"upgrade_intent"
"name":"upgrade_success"
```

Dedupe: `signup` and `first_scan` use `localStorage` once-per-uid keys (`analytics_<event>_<uid>`).

## Observability hooks in this repo

| Piece | Role |
|-------|------|
| `src/services/sentry.ts` | Env-gated `@sentry/react` init (`VITE_SENTRY_DSN`) |
| `src/services/observability.ts` | Ops events + `trackEvent` / `trackEventOnce` → `/api/error-log` |
| `api/error-log.ts` | JSON intake; alerts for 429/5xx/scan_failure; optional `SENTRY_DSN` forward |
| `ErrorBoundary` | Reports UI crashes with reference id |
| `ocr.ts` `callGeminiWithRetry` | Emits retry / 429 / 5xx / final scan_failure |

**Optional Sentry**

- Server: set `SENTRY_DSN` on Vercel (full DSN).
- Client: set `VITE_SENTRY_DSN` at **build** time — `initSentry()` loads `@sentry/react` when present.

## Related

- Accuracy baseline: `eval/accuracy/README.md`
- Deploy / env: `VERCEL_SETUP.md` (and operator runbook when published)
- Env template: `.env.example`
