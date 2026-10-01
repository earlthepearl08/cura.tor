# Cura.Tor draft PR merge order

**Audience:** Earl (merge authority)  
**Scope:** Open draft PRs on `earlthepearl08/cura.tor` (refreshed 2026-10-01)  
**Rule:** Do **not** bulk-merge. Merge one at a time; rebase the next PR onto `main` after each merge.

### Status snapshot (vs `origin/main` @ `ee4e1a2`)

| Range | GitHub `mergeable` / `mergeStateStatus` | Notes |
|-------|------------------------------------------|--------|
| **#1–#16** | `MERGEABLE` / **CLEAN** | Tip already contains current `main` (`behind=0`) |
| **#17–#21** | `MERGEABLE` / **UNSTABLE** | **Not behind main** — Vercel preview check still **pending** (UNSTABLE ≠ git conflict). Rebase of #14–#19 on 2026-10-01 was a no-op (`ALREADY_UP_TO_DATE`). |

---

## Inventory (21 open drafts)

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
| 21 | Public accuracy sample gallery | P0/P2 trust content | (marketing/eval samples — check PR files before merge) |

---

## Conflict hotspots (multi-PR ownership)

| File | PRs | Risk |
|------|-----|------|
| `src/pages/LogScan.tsx` | 3, 8, 9, 11, 14, 15, 16, 17, 18 | **Highest** — serialize log-sheet work |
| `src/pages/Settings.tsx` | 3, 4, 5, 8, 9, 10, 16, 17, 18, 19 | High — almost every feature adds a row |
| `src/pages/Contacts.tsx` | 3, 7, 8, 10, 12, 13, 14, 19 | High — team/export/claims/events |
| `src/services/ocr.ts` | 5, 6, 11, 14, 15, 18 | High — trust → accuracy → confidence → templates → i18n |
| `src/services/teamStorage.ts` | 7, 12, 13, 14, 17, 19 | High — realtime → claims → glossary → events |
| `src/contexts/AuthContext.tsx` | 4, 5, 8, 10 | Medium-high — billing/trust before export/upgrade UX |
| `firestore.rules` | 12, 13, 17, 19 | Medium-high — claims then glossary then events |
| `src/App.tsx` | 3, 16, 19 | Medium — landing → Help → Events routes |
| `package.json` | 2, 5, 6 | Medium — version/deps |
| `src/services/export.ts` | 8, 13, 14 | Medium — Sheets/CRM then follow-up cols then templates |
| `src/types/contact.ts` | 13, 14 | Medium — follow-up fields before template fields |
| `src/contexts/WorkspaceContext.tsx` | 7, 19 | Medium — realtime then event workspaces |

`CLEAN` means clean vs **today’s** `main`, not “clean forever.” Pairwise merges will conflict once earlier PRs land.

### Rebase pass (2026-10-01)

Serial `git rebase origin/main` on `#14–#19`: all **already up to date** (`behind=0`). No force-push. No git conflicts. `#17–#19` (and `#20`) remain **UNSTABLE** only while Vercel preview is pending.

---

## Safe merge order

### Phase A — P0 (sell / trust / story)

| Step | PR | Why this slot | Rebase after |
|------|-----|---------------|--------------|
| A0 | **#20 Merge-order doc** and/or **#1 Runbook** | Docs-only — free merges anytime | — |
| A1 | **#4 Stripe** | Billing fulfillment; touches `AuthContext`/`Settings` early | — |
| A2 | **#5 Trust** | Auth/Home/Legal honesty; overlaps `#4` on Auth/Settings | Rebase onto `#4` |
| A3 | **#3 Landing** | Public marketing; overlaps `#5` on `Auth.tsx`; adds `App.tsx` routes | Rebase onto `#5` |
| A4 | **#2 Tests** | Vitest + Stripe contract helpers; `package.json` shared with `#5`/`#6` | Rebase onto `#4`+`#5` |
| A5 | **#6 Accuracy** | Eval harness + `ocr.ts` / monitoring | Rebase onto `#5` (+ `#2` if sharing `package.json`) |
| A6 | **#21 Accuracy gallery** (if kept as P0 trust content) | After `#6` scaffold so gallery/eval story aligns | Rebase onto `#6` / landing as needed |

**P0 stop condition:** auth → scan → export smoke; checkout honesty; public landing; CI green.

### Phase B — P1 (retention / conversion)

| Step | PR | Depends on / rebase note |
|------|-----|---------------------------|
| B1 | **#10 Free-tier upgrade UX** | After `#5`. Prefer before `#8`. |
| B2 | **#9 First-run onboarding** | Before `#16` Help (Settings/Log/Multi). |
| B3 | **#8 Sheets + CRM CSV** | After AuthContext settles; before `#13`/`#14` export churn. |
| B4 | **#7 Realtime team sync** | Before `#12`/`#13`/`#19` (`Contacts`/`teamStorage`/`WorkspaceContext`). |
| B5 | **#11 OCR confidence review** | After `#6`; **before** `#14`/`#15`/`#18`. |

### Phase C — P2 (differentiators) — serialize LogScan / rules

| Step | PR | Depends on / rebase note |
|------|-----|---------------------------|
| C1 | **#12 Admin claim override** | After `#7`; before `#13`. |
| C2 | **#13 Follow-up pipeline** | After `#12`; before `#14` (`contact.ts` / export). |
| C3 | **#16 In-app help** | After `#3` (`App.tsx`); after `#9` if Help entry overlaps. |
| C4 | **#15 Guided log capture** | After `#11`; **before `#14`**. |
| C5 | **#14 Column templates** | After `#13` + `#15` + `#11`. |
| C6 | **#18 Multi-language OCR** | After `#11`/`#14`/`#15` settle `ocr.ts` + scan pages; before or after `#17` carefully on Settings. |
| C7 | **#17 Correction memory** | After `#12`/`#13` rules + `#11` ContactReview; rebase onto LogScan stack. |
| C8 | **#19 Event workspaces** | **Late** — touches `App.tsx`, `firestore.rules`, `WorkspaceContext`, `Contacts`, `Home`, `Settings`. After `#7` + claim rules (`#12`/`#13`) at minimum; rebase onto `#3`/`#16` for `App.tsx`. |

---

## Per-hotfile “who wins first” cheat sheet

- **`AuthContext`:** `#4` → `#5` → `#10` → `#8`
- **`Settings`:** `#4` → `#5` → `#3` → `#10` → `#9` → `#8` → `#16` → `#18` → `#17` → `#19`
- **`App.tsx`:** `#3` → `#16` → `#19`
- **`LogScan`:** `#3` → `#9` → `#8` → `#11` → `#15` → `#14` → `#16` → `#18` → `#17`
- **`Contacts`:** `#3` → `#7` → `#10` → `#8` → `#12` → `#13` → `#14` → `#19`
- **`ocr.ts`:** `#5` → `#6` → `#11` → `#15` → `#14` → `#18`
- **`firestore.rules`:** `#12` → `#13` → `#17` → `#19`
- **`export.ts`:** `#8` → `#13` → `#14`
- **`WorkspaceContext`:** `#7` → `#19`

---

## Merge ritual (per PR)

1. Earl reviews draft → mark ready when intentional.  
2. `gh pr checkout <n> && git fetch origin main && git rebase origin/main`.  
3. Fix conflicts; run `npm test` / `tsc` / critical paths as applicable.  
4. Merge with one consistent strategy (merge commit or squash).  
5. Rebase the **next** PR in the table onto updated `main`.  
6. Treat `UNSTABLE` as “checks pending/failing” first — confirm `behind` with `git rev-list` before assuming conflicts.

---

## Intentionally not merging yet

- No automatic multi-PR merge train without Earl.  
- `#14` + `#15` remain the highest collision pair on `LogScan`/`ocr`.  
- `#19` event workspaces is a wide blast radius — keep until claim + realtime land.  
- `#2` Stripe contract tests vs `#4` webhook: tiny follow-up on `main` if they diverge after merge.

---

## Quick reference — one-line order

```
#20/#1 (docs anytime) → #4 Stripe → #5 Trust → #3 Landing → #2 Tests → #6 Accuracy → (#21 gallery)
→ #10 Upgrade UX → #9 Onboarding → #8 Sheets → #7 Realtime → #11 Confidence
→ #12 Claim admin → #13 Follow-up → #16 Help → #15 Guided capture → #14 Templates
→ #18 i18n → #17 Glossary → #19 Event workspaces
```
