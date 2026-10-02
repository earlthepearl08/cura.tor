# Production monitoring (Cura.Tor)

Short operator checklist for **Gemini cost-per-scan** and **rate-limit / error alerts**. Complements the accuracy harness in `eval/accuracy/`.

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

## Observability hooks in this repo

| Piece | Role |
|-------|------|
| `src/services/observability.ts` | Structured client events + POST `/api/error-log` |
| `api/error-log.ts` | JSON log intake; optional `SENTRY_DSN` forward |
| `ErrorBoundary` | Reports UI crashes (not console-only) |
| `ocr.ts` `callGeminiWithRetry` | Emits retry / 429 / 5xx / final scan_failure |

**Optional Sentry**

- Server: set `SENTRY_DSN` on Vercel (full DSN).
- Client: set `VITE_SENTRY_DSN` and load the Sentry browser SDK when you are ready — the stub calls `globalThis.Sentry` if present.

## Related

- Accuracy baseline: `eval/accuracy/README.md`
- Deploy / env: `VERCEL_SETUP.md` (and operator runbook when published)
