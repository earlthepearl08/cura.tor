# Cura.Tor draft PR merge order

**Audience:** Earl (merge authority)  
**Scope:** Open draft PRs on `earlthepearl08/cura.tor` as of 2026-10-01  
**Rule:** Do **not** bulk-merge. Merge one at a time; rebase the next PR onto `main` after each merge.  
**Status signal:** GitHub reports `#1–#13` as `MERGEABLE/CLEAN` vs current `main`; `#14–#17` as `MERGEABLE/UNSTABLE` (likely behind / noisier conflict risk — rebase before review).

---

## Inventory (17 open drafts)

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

---

## Conflict hotspots (multi-PR ownership)

| File | PRs | Risk |
|------|-----|------|
| `src/pages/LogScan.tsx` | 3, 8, 9, 11, 14, 15, 16, 17 | **Highest** — serialize log-sheet work |
| `src/pages/Settings.tsx` | 3, 4, 5, 8, 9, 10, 16, 17 | High — almost every feature adds a row |
| `src/pages/Contacts.tsx` | 3, 7, 8, 10, 12, 13, 14 | High — team/export/claims pile-up |
| `src/services/ocr.ts` | 5, 6, 11, 14, 15 | High — trust → accuracy → confidence → templates |
| `src/services/teamStorage.ts` | 7, 12, 13, 14, 17 | High — realtime then claims then glossary |
| `src/contexts/AuthContext.tsx` | 4, 5, 8, 10 | Medium-high — billing/trust before export/upgrade UX |
| `firestore.rules` | 12, 13, 17 | Medium — claim rules then glossary |
| `src/App.tsx` | 3, 16 | Medium — landing routes before Help route |
| `package.json` | 2, 5, 6 | Medium — version/deps |
| `src/services/export.ts` | 8, 13, 14 | Medium — Sheets/CRM then follow-up cols then templates |
| `src/types/contact.ts` | 13, 14 | Medium — follow-up fields before template fields |

`gh` currently marks all as mergeable against `main`, but **pairwise** merges will conflict once earlier PRs land. Treat `CLEAN` as “clean vs today’s main,” not “clean forever.”

---

## Safe merge order

### Phase A — P0 (sell / trust / story)

Requested sequence with small safety tweaks called out:

| Step | PR | Why this slot | Rebase after |
|------|-----|---------------|--------------|
| A0 (optional first) | **#1 Runbook** | Docs-only, zero app conflict — free merge anytime | — |
| A1 | **#4 Stripe** | Billing fulfillment unblocks paid claims; touches `AuthContext`/`Settings` early | — |
| A2 | **#5 Trust** | Auth/Home/Legal honesty; overlaps `#4` on `AuthContext`/`Settings` | Rebase onto `#4` |
| A3 | **#3 Landing** | Public marketing; overlaps `#5` on `Auth.tsx`, adds `App.tsx` routes | Rebase onto `#5` |
| A4 | **#2 Tests** | Vitest + Stripe **contract** helpers; `package.json` also touched by `#5`/`#6` | Rebase onto `#4`+#`5` (webhook + package.json) |
| A5 | **#1 Runbook** | If not done in A0 | Anytime |
| A6 | **#6 Accuracy** | Eval harness + `ocr.ts` / monitoring; `#5` already edited `ocr.ts` | Rebase onto `#5` (+ `#2` if sharing `package.json`) |

**Recommended tweak vs literal “Tests before Runbook”:** keep #1 as A0 or A5 — it never blocks. Prefer **#4 before #2** so webhook contract tests sit next to the real webhook file after merge (or expect a follow-up commit on #2 if contract module and webhook diverge).

**P0 stop condition:** After Phase A, do a smoke pass: auth → scan → export, checkout redirect honesty, landing `/` public, CI green.

### Phase B — P1 (retention / conversion)

| Step | PR | Depends on / rebase note |
|------|-----|---------------------------|
| B1 | **#10 Free-tier upgrade UX** | After `#5` (Home/Settings/AuthContext). Before or after `#8` — if both open, merge `#10` first (conversion) then `#8`. |
| B2 | **#9 First-run onboarding** | After `#3` Settings chrome if any; before `#16` Help (both Settings/Log/Multi). |
| B3 | **#8 Sheets + CRM CSV** | After `#4`/`#5` AuthContext settles; before `#13`/`#14` export column churn. |
| B4 | **#7 Realtime team sync** | Before claim PRs `#12`/`#13` (shared `Contacts`/`teamStorage`). |
| B5 | **#11 OCR confidence review** | After `#6` if `#6` changed `ocr.ts`; **before** `#14`/`#15`. |

### Phase C — P2 (differentiators) — serialize LogScan

| Step | PR | Depends on / rebase note |
|------|-----|---------------------------|
| C1 | **#12 Admin claim override** | After `#7`; before `#13` (shared `firestore.rules` / claims). |
| C2 | **#13 Follow-up pipeline** | After `#12`; before `#14` (`contact.ts` / export). |
| C3 | **#16 In-app help videos** | After `#3` (`App.tsx`); after `#9` if both touch Settings Help entry — compose Help page + tip sheets. |
| C4 | **#15 Guided log capture** | After `#11`; **before or tightly with `#14`** — both rewrite `LogScan`/`ocr`. Prefer landing guided capture first, then templates rebase onto it. |
| C5 | **#14 Column templates** | After `#13` (`contact.ts`) + `#15` (LogScan UX) + `#11`. |
| C6 | **#17 Correction memory** | After `#12`/`#13` rules + `#11` ContactReview; late LogScan touch — rebase onto C4/C5. |

---

## Per-hotfile “who wins first” cheat sheet

- **`AuthContext`:** `#4` → `#5` → `#10` → `#8`
- **`Settings`:** `#4` → `#5` → `#3` → `#10` → `#9` → `#8` → `#16` → `#17`
- **`App.tsx`:** `#3` → `#16`
- **`LogScan`:** `#3` (light) → `#9` → `#8` (export menu) → `#11` → `#15` → `#14` → `#16` → `#17`
- **`Contacts`:** `#3` (light) → `#7` → `#10` → `#8` → `#12` → `#13` → `#14`
- **`ocr.ts`:** `#5` → `#6` → `#11` → `#15` → `#14`
- **`firestore.rules`:** `#12` → `#13` → `#17`
- **`export.ts`:** `#8` → `#13` → `#14`

---

## Merge ritual (per PR)

1. Earl reviews draft → mark ready when intentional.  
2. `gh pr checkout <n> && git fetch origin main && git rebase origin/main` (or merge main).  
3. Fix conflicts; run `npm test` / `tsc` / critical paths as applicable.  
4. Merge with merge commit or squash (pick one repo convention and stick to it).  
5. Tell open PR agents / rebase the next PR in the table.  
6. Do **not** merge `#14–#17` until Phase A–B LogScan/Contacts owners have landed.

---

## Intentionally not merging yet

- No automatic multi-PR merge train without Earl.  
- `#14` + `#15` are the highest collision pair — consider asking authors to rebase onto each other or combine before merge.  
- `#2` Stripe contract tests vs `#4` webhook implementation: if they diverge after merge, prefer a tiny follow-up on `main` over force-fitting both in one conflicted rebase.

---

## Quick reference — one-line order

```
#1 (docs anytime) → #4 Stripe → #5 Trust → #3 Landing → #2 Tests → #6 Accuracy
→ #10 Upgrade UX → #9 Onboarding → #8 Sheets → #7 Realtime → #11 Confidence
→ #12 Claim admin → #13 Follow-up → #16 Help → #15 Guided capture → #14 Templates → #17 Glossary
```
