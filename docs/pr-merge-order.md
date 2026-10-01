# Cura.Tor draft PR merge order

**Audience:** Earl (merge authority)  
**Scope:** Open draft PRs on `earlthepearl08/cura.tor` (refreshed 2026-10-01)  
**Rule:** Do **not** bulk-merge. Merge one at a time; rebase the next PR onto `main` after each merge.

### Status snapshot (vs `origin/main` @ `ee4e1a2`)

| Range | GitHub status | Notes |
|-------|---------------|--------|
| **#1–#17** | Typically **CLEAN** once Vercel finishes | Tips contain current `main` (`behind=0`) |
| **#18–#24** | Often **UNSTABLE** while Vercel preview is **pending** | **Not git-behind** — `UNSTABLE ≠ conflict`. Confirm with `git rev-list` before assuming rebase pain. |

**Rebase passes (2026-10-01):** `#14–#19` and `#21–#23` → all `ALREADY_UP_TO_DATE` on `origin/main`. No force-pushes. No conflicts.

---

## Inventory (24 open drafts)

| # | Title | Theme | Hot files touched |
|---|--------|--------|-------------------|
| 1 | Operator runbook; correct TECHNICAL_SPEC | P0 docs | `README.md`, `TECHNICAL_SPEC.md` only |
| 2 | Critical-path tests (Vitest + RTL) | P0 tests | `package.json`, Stripe webhook **contract** tests under `api/` |
| 3 | Public marketing landing + pricing | P0 landing | `App.tsx`, `Auth.tsx`, `Settings.tsx`, many scan pages (nav/chrome) |
| 4 | Stripe billing lifecycle | P0 billing | `api/stripe-webhook.ts`, checkout/portal, `AuthContext`, `Settings` |
| 5 | Trust blockers + Auth/Home UX | P0 trust | `Auth`, `Home`, `Settings`, `Legal`, `ocr.ts`, `package.json` |
| 6 | Accuracy eval + monitoring scaffold | P0 accuracy | `eval/`, `ocr.ts`, `gemini.ts`, `package.json`, observability |
| 7 | Real-time team contact sync | P1 team | `Contacts`, `teamStorage`, `WorkspaceContext` |
| 8 | Google Sheets + CRM-ready CSV | P1 CRM | `AuthContext`, `Contacts`, `export`, `Settings`, Log/Multi export menus |
| 9 | First-run Log/Multi onboarding | P1 onboarding | `LogScan`, `MultiCardScan`, `Settings` |
| 10 | Free-tier upgrade conversion UX | P1 conversion | `AuthContext`, `Home`, `Settings`, `Contacts`, scan/upload |
| 11 | OCR field confidence + log review UX | P1 OCR UX | `ocr.ts`, `LogScan`, `ContactReview` |
| 12 | Admin claim override / reassign | P2 claims | `firestore.rules`, `Contacts`, `teamStorage` |
| 13 | Follow-up pipeline on claims | P2 claims | `contact.ts`, `Contacts`, `firestore.rules`, `export`, `teamStorage` |
| 14 | Log-sheet column mapping + templates | P2 templates | `LogScan`, `ocr`, `contact.ts`, `export`, `Contacts`, `teamStorage` |
| 15 | Guided log capture + mapping confirm | P2 capture | `LogScan`, `ocr` (heavy) |
| 16 | In-app help video slots | P2 help | `App.tsx`, `Settings`, Scan/Log/Multi headers |
| 17 | Correction memory / org glossary | P2 glossary | `firestore.rules`, `teamStorage`, Log/Multi, `Settings`, `ContactReview` |
| 18 | Multi-language OCR + i18n scaffold | P2 i18n | `ocr.ts`, `Settings`, Scan/Log/Multi, `src/i18n/*` |
| 19 | Shared event workspaces | P2 events | `App.tsx`, `firestore.rules`, `WorkspaceContext`, `Contacts`, `Home`, `Settings`, `teamStorage` |
| 20 | PR merge-order doc (this file) | Meta | `docs/pr-merge-order.md` only — merge anytime |
| 21 | Public accuracy sample gallery | P0 trust content | `App.tsx`, `AccuracyGallery`, `Auth`, `Legal`, `Settings`, `public/accuracy-samples/*` |
| 22 | Sentry init + product funnel analytics | P1 observability | `package.json`, `main.tsx`, `observability`/`sentry`, `AuthContext`, `ocr.ts`, `Settings`, `api/gemini` |
| 23 | Accessibility pass (Scan/Log/Contacts/Auth/Home) | P2 a11y | `App.tsx`, `Auth`, `Home`, `Contacts`, `LogScan`, `Scan`, `index.css` |
| 24 | Wire `/accuracy` into landing nav/footer | P0 polish | Likely `Landing` / nav — rebase after `#3` + `#21` |

---

## Conflict hotspots (multi-PR ownership)

| File | PRs | Risk |
|------|-----|------|
| `src/pages/LogScan.tsx` | 3, 8, 9, 11, 14, 15, 16, 17, 18, 23 | **Highest** |
| `src/pages/Settings.tsx` | 3, 4, 5, 8, 9, 10, 16, 17, 18, 19, 21, 22 | High |
| `src/pages/Contacts.tsx` | 3, 7, 8, 10, 12, 13, 14, 19, 23 | High |
| `src/services/ocr.ts` | 5, 6, 11, 14, 15, 18, 22 | High |
| `src/services/teamStorage.ts` | 7, 12, 13, 14, 17, 19 | High |
| `src/contexts/AuthContext.tsx` | 4, 5, 8, 10, 22 | Medium-high |
| `src/App.tsx` | 3, 16, 19, 21, 23 | Medium-high — landing → Help → Events → gallery → a11y |
| `firestore.rules` | 12, 13, 17, 19 | Medium-high |
| `package.json` | 2, 5, 6, 22 | Medium |
| `src/pages/Auth.tsx` | 3, 5, 21, 23 | Medium |
| `src/pages/Home.tsx` | 5, 10, 19, 23 | Medium |
| `src/services/export.ts` | 8, 13, 14 | Medium |
| `src/types/contact.ts` | 13, 14 | Medium |
| `src/contexts/WorkspaceContext.tsx` | 7, 19 | Medium |

`CLEAN` = clean vs **today’s** `main`, not forever. Pairwise merges still conflict after earlier PRs land.

---

## Safe merge order

### Phase A — P0 (sell / trust / story)

| Step | PR | Why this slot |
|------|-----|---------------|
| A0 | **#20** / **#1** | Docs-only — anytime |
| A1 | **#4 Stripe** | Billing first |
| A2 | **#5 Trust** | Rebase onto `#4` (Auth/Settings) |
| A3 | **#3 Landing** | Rebase onto `#5` (Auth); adds `App.tsx` |
| A4 | **#2 Tests** | After `#4`/`#5` (`package.json` + webhook contract) |
| A5 | **#6 Accuracy scaffold** | After `#5` (`ocr.ts`) |
| A6 | **#21 Accuracy gallery** | After `#3` (`App.tsx`/`Auth`) + ideally `#6` story alignment |
| A7 | **#24 Accuracy nav wire-up** | After `#3` + `#21` |

### Phase B — P1 (retention / conversion / ops)

| Step | PR | Notes |
|------|-----|--------|
| B1 | **#10 Free-tier upgrade UX** | After `#5` |
| B2 | **#9 Onboarding** | Before `#16` |
| B3 | **#8 Sheets + CRM** | After AuthContext settles |
| B4 | **#7 Realtime sync** | Before claims / `#19` |
| B5 | **#11 OCR confidence** | Before `#14`/`#15`/`#18` |
| B6 | **#22 Sentry + analytics** | After `#5`/`#6` if sharing `ocr`/observability/`package.json`; before heavy Settings pile-up if possible |

### Phase C — P2 (differentiators) — serialize LogScan / App

| Step | PR | Notes |
|------|-----|--------|
| C1 | **#12 Claim admin** → **#13 Follow-up** | Rules + Contacts |
| C2 | **#16 Help** | After `#3` App routes |
| C3 | **#15 Guided capture** → **#14 Templates** | LogScan/`ocr` |
| C4 | **#18 i18n** | After OCR stack settles |
| C5 | **#17 Glossary** | After rules + ContactReview |
| C6 | **#23 Accessibility** | Wide UI surface (`Auth`/`Home`/`Contacts`/`LogScan`/`Scan`/`App`) — late Phase C or after Phase A landing/trust so chrome is stable; rebase onto `#3`/`#5`/`#21` App/Auth touches |
| C7 | **#19 Event workspaces** | Latest — largest blast radius |

---

## Per-hotfile “who wins first” (updated)

- **`AuthContext`:** `#4` → `#5` → `#10` → `#8` → `#22`
- **`Settings`:** `#4` → `#5` → `#3` → `#10` → `#9` → `#8` → `#16` → `#21` → `#22` → `#18` → `#17` → `#19`
- **`App.tsx`:** `#3` → `#16` → `#21` → `#23` → `#19`
- **`LogScan`:** `#3` → `#9` → `#8` → `#11` → `#15` → `#14` → `#16` → `#18` → `#17` → `#23`
- **`Contacts`:** `#3` → `#7` → `#10` → `#8` → `#12` → `#13` → `#14` → `#19` → `#23`
- **`ocr.ts`:** `#5` → `#6` → `#11` → `#15` → `#14` → `#18` → `#22`
- **`firestore.rules`:** `#12` → `#13` → `#17` → `#19`
- **`package.json`:** `#5` → `#2` → `#6` → `#22`

---

## Merge ritual (per PR)

1. Earl reviews draft → mark ready when intentional.  
2. `gh pr checkout <n> && git fetch origin main && git rebase origin/main`.  
3. Fix conflicts; run tests / `tsc` as applicable.  
4. Merge with one consistent strategy.  
5. Rebase the **next** PR onto updated `main`.  
6. If status is `UNSTABLE`, check Vercel pending **before** assuming git conflicts (`behind` count).

---

## Intentionally not merging yet

- No automatic multi-PR merge train without Earl.  
- `#14` + `#15` remain the highest LogScan collision pair.  
- `#19` and `#23` are wide UI/rules blasts — keep late.  
- `#22` overlaps `#6` observability story — prefer `#6` then `#22` or expect a combine/rebase.

---

## Quick reference — one-line order

```
#20/#1 (docs) → #4 Stripe → #5 Trust → #3 Landing → #2 Tests → #6 Accuracy → #21 Gallery → #24 Accuracy nav
→ #10 Upgrade UX → #9 Onboarding → #8 Sheets → #7 Realtime → #11 Confidence → #22 Sentry
→ #12 Claim admin → #13 Follow-up → #16 Help → #15 Guided → #14 Templates
→ #18 i18n → #17 Glossary → #23 a11y → #19 Event workspaces
```
