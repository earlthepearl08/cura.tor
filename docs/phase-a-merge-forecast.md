# Phase A merge-day forecast

**Audience:** Earl  
**Order:** `#1 → #4 → #5 → #35 → #33 → #40 → #24 → #38 → #44 → #47 → #49 → #2 → #48 → #43 → #45 → #32 → #6 → #36`  
**Ritual:** merge one → wait for green/Vercel → `rebase origin/main` on the next tip → repeat.  
**Source:** `docs/pr-merge-order.md` + current PR file lists (gh). Do not merge #3 or #21 separately once #24 is in play.

**Risk legend:** Low = docs/new files · Med = shared file, usually section-level · High = same hot file as a prior merge in this train

---

## Per-PR forecast

| Step | PR | Likely conflict vs already-on-`main` | What to watch / tip |
|-----:|----|--------------------------------------|---------------------|
| 1 | **#1** Operator runbook | **Low** — `README.md`, `TECHNICAL_SPEC.md` | First land. Sets `TECHNICAL_SPEC` baseline for #33. |
| 2 | **#4** Stripe lifecycle | **Med** — new APIs mostly; touches `AuthContext`, `Settings`, `.env.example` | Foundation for #32 / billing. After merge, set webhook + Vercel secrets before relying on tier. |
| 3 | **#5** Trust / Auth / Home | **High** — `AuthContext`, `Settings` already touched by **#4**; also `Auth`, `Home`, `Legal`, `ocr.ts`, `package.json` | Expect AuthContext/Settings rebase. Keep Legal edits clean for #33/#40. |
| 4 | **#35** Password reset | **High** — `Auth.tsx`, `AuthContext` just from **#5** (and #4) | Small PR; rebase immediately after #5. Do not let #28 magic-link jump ahead. |
| 5 | **#33** Legal subprocessors | **Med–High** — `Legal.tsx` after **#5**; `TECHNICAL_SPEC.md` after **#1** | Resolve Legal section order + any TECHNICAL_SPEC hunks from #1. |
| 6 | **#40** DPA stub | **High** — `Legal.tsx` after **#33** (+ #5) | New `DPA.md` / `public/dpa.md` are easy; Legal link row is the conflict. Merge right after #33. |
| 7 | **#24** Landing + gallery + nav | **Med–High** — `Auth`, `Legal`, `Settings` already hot from #5/#35/#33/#40; adds `App`, `Landing`, gallery assets | Prefer this single stack over #3+#21. Close #21 (and skip #3) after land. Retarget stacked PRs (#38+) to `main` if GitHub still shows #24 as base. |
| 8 | **#38** Landing SEO | **High** — `Landing.tsx`, `AccuracyGallery.tsx` from **#24**; adds `PageMeta`, `index.html` | Stacked on #24. Rebase/retarget after #24; usually clean if #24 is sole Landing owner so far. |
| 9 | **#44** Competitor section | **High** — `Landing.tsx` after **#24/#38** | Same stack base. Expect mid-page section conflicts with SEO/meta wrappers from #38. |
| 10 | **#47** `/accuracy#report` | **High** — `Landing`, `AccuracyGallery` after #38/#44; also `Auth`, `Legal`, `Settings` (link rows) | Biggest landing-stack conflict after #24. Rebase onto tip that includes #38+#44. Legal/Settings are link-only — take theirs + keep report routes. |
| 11 | **#49** Sample demo CTA | **High** — `Landing.tsx`, `AccuracyGallery.tsx` after **#47** | Last Landing/gallery product PR in Phase A. Rebase onto #47 tip; CTA vs report section placement. |
| 12 | **#2** Critical-path tests | **Med** — `package.json` / lockfile after **#5**; new vitest tree | Mostly additive. Watch scripts/deps in `package.json` vs #5. |
| 13 | **#48** Vitest GHA CI | **High overlap with #2** — includes same test stack + workflow | **After #2.** If #48 fully contains #2’s tip, Git may be mostly already-applied + new `.github/workflows/vitest.yml`. Prefer #2 then #48; don’t merge #48 before #2 unless intentionally superseding. |
| 14 | **#43** Playwright smokes | **Med–High** — `package.json`, `TESTING.md` after #2/#48; light `AuthContext`, `Contacts` | New `e2e/` is clean. Rebase AuthContext mock flag carefully vs #4/#5/#35. |
| 15 | **#45** Playwright GHA CI | **High overlap with #43** — includes e2e tree + workflow | Same pattern as #48→#2. Merge **after #43**; expect e2e files already present + new workflow. |
| 16 | **#32** Webhook Vitest fixtures | **High** — `package.json`, vitest setup, fixtures after **#2/#48**; may touch `api/stripe-webhook.ts` after **#4**; overlaps #2 contract tests | Rebase onto #48 tip. Resolve fixture/setup duplicates with #2/#48; keep #4 handler behavior. |
| 17 | **#6** Accuracy + monitoring scaffold | **Med** — `package.json` after test train; `ocr.ts` after **#5**; `.env.example` after **#4**; new `eval/`, monitoring | Eval tree mostly new. Watch `ocr.ts` / `package.json` / env example. |
| 18 | **#36** Synthetic golden set 30/10 | **Med–High on `eval/`** — expands fixtures/README after **#6** | Stay in `eval/accuracy/`. Rebase onto #6; accept #36 fixture expansion over #6’s smaller seed set where they overlap (`card-001`, etc.). |

---

## Hot clusters (merge-day cheat sheet)

1. **Auth train:** `#4 → #5 → #35` — `AuthContext` / `Auth.tsx` / `Settings`  
2. **Legal train:** `#5 → #33 → #40` (+ #24/#47 link touches) — `Legal.tsx`  
3. **Landing stack:** `#24 → #38 → #44 → #47 → #49` — `Landing.tsx` / `AccuracyGallery.tsx` (serial only)  
4. **Test/CI train:** `#2 → #48 → #43 → #45 → #32` — `package.json`, `TESTING.md`, vitest/e2e trees  
5. **Eval train:** `#6 → #36` — `eval/accuracy/`

---

## Stacked-base checklist

After **#24** lands on `main`:

- [ ] Retarget **#38, #44, #47, #49** from `cursor/landing-accuracy-nav-link-9334` → `main` (or rebase each onto `main`)
- [ ] Close **#21** (and skip standalone **#3**)

After **#2** / **#43** land:

- [ ] Confirm **#48** / **#45** still apply cleanly (they include prior trees + CI workflows)

---

## Meta (not in the one-liner; safe same day)

| PR | When | Conflict note |
|----|------|---------------|
| **#20 / #27** | Anytime | Docs only (`pr-merge-order`, go-live) |
| **#37** Gemini ops | Anytime with #1 | Light `api/ocr.ts` / `api/gemini.ts` — rebase if #6 already landed |
| **#50** Lighthouse CI | Anytime with #45/#48 | `package.json` + new workflow — after Landing (#24+) for meaningful runs |
| **#46** `api/_lib` | After #4; prefer after #31 | Not Phase A blocker; OCR API maintenance |

---

## Smoke after each cluster (minimum)

| After | Quick check |
|-------|-------------|
| #4 | Checkout/portal + webhook updates tier (or staging equivalent) |
| #5+#35 | Sign-in + password reset email path |
| #33+#40 | Legal shows subprocessors + DPA link |
| #24…#49 | `/`, `/accuracy`, SEO tags, competitor section, `#report`, demo CTA |
| #2+#48+#32 | `npm test` / Vitest CI green |
| #43+#45 | Playwright smoke CI green |
| #6+#36 | Eval README runs / golden set present |

Full ops list: `docs/go-live-checklist.md` (Context + repo PR #27).
