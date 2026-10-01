# Gemini / Vision — production billing & rate monitoring

Operator checklist before **paid traffic** or Pro log-sheet promotion. No in-app dashboard — use Google billing + Vercel logs (and optional Sentry when wired).

Related: `VERCEL_SETUP.md` (key install) · `.env.example` · [`#31` friendly OCR errors](https://github.com/earlthepearl08/cura.tor/pull/31)

---

## 1. Paid Google AI billing checklist

Free Gemini / AI Studio quotas **will 429** under multi-user Pro load (especially log sheets). Do this before ads or broad invites:

- [ ] Create / confirm API key at [Google AI Studio](https://aistudio.google.com/apikey) (model used: **`gemini-2.5-flash`** in `api/gemini.ts`)
- [ ] Enable **paid billing** on the Google Cloud / AI project that owns the key (not free-tier-only)
- [ ] Set a **billing budget** + email alerts (e.g. 50% / 90% / 100% of expected monthly Gemini spend)
- [ ] Put the key in Vercel as **`GEMINI_API_KEY`** (server-only; no `VITE_` prefix). Optional: `GOOGLE_API_KEY` for Cloud Vision (`api/ocr.ts`)
- [ ] Redeploy; smoke one authenticated single-card scan → `200` from `/api/gemini`
- [ ] Confirm Vision path if you use Cloud Vision engine (`GOOGLE_API_KEY` + `/api/ocr`)
- [ ] Keep a kill-switch plan: rotate/revoke the key in Google Console if spend spikes

**App-side ceilings already in place** (`api/gemini.ts` / `api/ocr.ts`, per Firebase uid):

| Window | Cap |
|--------|-----|
| Minute | 60 |
| Hour | 600 |
| Day | 3000 |

Plus **tier quota** (e.g. free = 5 scans/month). Abuse ceilings ≠ Google’s upstream quota — both can return **429**.

---

## 2. Watching 429 / 5xx

### Where logs live today

| Layer | What to look for |
|-------|------------------|
| **Vercel → project → Logs** (filter `api/gemini` / `api/ocr`) | `Gemini API error: <status>` · `Cloud Vision API error:` · `[api/gemini] Rate limit` / `Quota check` |
| **Response JSON** | `reason: "quota-exceeded"` · `reason: "rate-limit-minute\|hour\|day"` · upstream body in `details` |
| **Client** | `callGeminiWithRetry` in `src/services/ocr.ts` retries **429 / 500 / 502 / 503 / 504** with 1s → 2s → 4s backoff (3 attempts) |

There is **no** dedicated health dashboard in-repo. Treat Vercel function logs + Google usage/billing as the source of truth. (A separate PR may add `/api/error-log` / Sentry stubs — until then, rely on `console.error` lines above.)

### Operator alert heuristics (start here)

- [ ] Spike of upstream **`Gemini API error: 429`** → check Google quota / paid tier / RPM limits
- [ ] Many **`reason: rate-limit-*`** across **many** uids → possible abuse or bot traffic
- [ ] Many **`quota-exceeded`** → expected for free users; only alert if volume looks automated
- [ ] **`Gemini API error: 5xx`** or our `500` after key/config issues → page if sustained (~>5% of Gemini calls / 15 min is a reasonable first threshold)
- [ ] Watch Vercel **`api/gemini` duration** (log sheets can approach client timeouts ~90s)

---

## 3. Rough cost-per-scan notes

**Pricing reference (verify before ads):** [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) — **Gemini 2.5 Flash** paid tier is on the order of **~$0.30 / 1M input** (text/image) and **~$2.50 / 1M output** (incl. thinking). Numbers change; re-check the link.

| Flow | What hits Gemini | Rough ballpark* |
|------|------------------|-----------------|
| Single card | 1 compressed image + prompt → short JSON | Fractions of a cent → ~1¢ |
| Multi-card | Same image path, denser output | ~2–4× single |
| Log sheet | Full-page image + many rows of JSON | Highest; often several × multi-card |

\*Ballpark only — image tokenization, prompt size, and thinking tokens dominate. **Measure your real average:**

```text
cost_per_scan ≈ (monthly Gemini spend for this key)
              / (successful scan count)
```

Successful scans ≈ Firestore `scanUsage` increments, or count of `200` responses from `/api/gemini` in Vercel analytics/logs. Track log-sheet volume separately when estimating Pro margins.

**Margin sanity:** Pioneer/Pro list prices must stay above blended cost of log-sheet-heavy usage after retries (each retry can bill again).

---

## 4. In-app / rate-limit UX (where users see it)

| Situation | Server | User-facing surface (main / today) | Improved by [#31](https://github.com/earlthepearl08/cura.tor/pull/31) |
|-----------|--------|--------------------------------------|--------|
| Free monthly scan cap (client gate) | — | `UpgradePrompt` `feature="scan"` on **Scan**, **Upload**, etc. via `canPerformScan()` | Same prompt; clearer copy when mid-request |
| Tier quota hit mid-request | `429` + `reason: "quota-exceeded"` | Settings usage bar; scan pages show busy/error strings; upgrade modal when client detects limit | Dedicated **quota** messaging + upgrade CTA (Scan / Log / Multi) |
| App abuse ceiling | `429` + `reason: "rate-limit-*"` | LogScan / MultiCard / Upload map 429/rate/quota → “server is busy… try again” | Shared `friendlyScanError` → wait/retry (not upgrade) |
| Upstream Gemini 429 / overloaded | Proxied status + details | Client retries, then similar busy/error copy | Classified as **rate_limit** / busy |
| Upstream / proxy 5xx | `500`/`503` etc. | “temporary issue” / raw error in places | Classified as **server** → retry copy |
| Network / timeout | — | Abort / timeout strings on scan pages | **network** / **timeout** kinds |

**Primary UI files:** `src/components/UpgradePrompt.tsx` · `src/pages/Scan.tsx` · `LogScan.tsx` · `MultiCardScan.tsx` · `Upload.tsx` · Settings scan usage (`src/pages/Settings.tsx`). After #31 merges: also `src/utils/friendlyScanError.ts`.

Operators debugging “users say scans are broken” should distinguish:

1. **quota-exceeded** → product/tier (upgrade or wait for reset)  
2. **rate-limit-*** → slow down / possible abuse  
3. **Upstream 429/5xx** → Google billing, quota, or outage  

---

## 5. API logging note (no fake dashboards)

`api/gemini.ts` and `api/ocr.ts` already:

1. Enforce JWT + per-uid rate limit + tier quota  
2. Forward upstream HTTP status to the client  
3. **`console.error`** failures with status + body snippet  

**Grep tips (Vercel logs):**

```text
[api/gemini]
Gemini API error:
Rate limit exceeded
quota-exceeded
GOOGLE_API_KEY / GEMINI_API_KEY not found
```

Do not expect a `/api/health` metrics UI in this repo; add log drains or Sentry outside the app if you need paging.
