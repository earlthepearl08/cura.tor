# Cura.Tor draft PR merge order

**Audience:** Earl (merge authority)  
**Scope:** Open draft PRs on `earlthepearl08/cura.tor` (refreshed 2026-10-01)  
**Rule:** Do **not** bulk-merge. Merge one at a time; rebase the next PR onto `main` after each merge.

### Status snapshot (vs current `main`)

| Signal | Meaning |
|--------|---------|
| **CLEAN** | Mergeable vs today’s `main` (still expect pairwise conflicts after earlier merges) |
| **UNSTABLE** | Often **Vercel pending**, not git-behind — confirm with `git rev-list …..origin/main` before assuming conflicts |

Ready-for-review (not draft) as of last undraft passes: **#4–#13** P0/P1/claim P2 subset — confirm with `gh pr list` before merge day.

---

## Inventory (#1–#28)

| # | Title | Theme | Hot files / notes |
|---|--------|--------|-------------------|
| 1 | Operator runbook | P0 docs | `README.md`, `TECHNICAL_SPEC.md` |
| 2 | Critical-path tests | P0 tests | `package.json`, Stripe webhook contract tests |
| 3 | Public landing + pricing | P0 landing | `App.tsx`, `Auth.tsx`, `Landing.tsx`, Settings chrome |
| 4 | Stripe billing lifecycle | P0 billing | webhook, checkout/portal, `AuthContext`, `Settings` |
| 5 | Trust / Auth / Home UX | P0 trust | Auth, Home, Legal, Settings, `ocr.ts` |
| 6 | Accuracy eval + monitoring scaffold | P0 accuracy | `eval/`, `ocr.ts`, observability hooks |
| 7 | Realtime team sync | P1 team | `Contacts`, `teamStorage`, `WorkspaceContext` |
| 8 | Google Sheets + CRM CSV | P1 CRM | AuthContext, Contacts, export, Settings |
| 9 | First-run Log/Multi onboarding | P1 onboarding | LogScan, MultiCardScan, Settings |
| 10 | Free-tier upgrade UX | P1 conversion | AuthContext, Home, Settings, Contacts |
| 11 | OCR confidence review UX | P1 OCR UX | `ocr.ts`, LogScan, ContactReview |
| 12 | Admin claim override | P2 claims | `firestore.rules`, Contacts, teamStorage |
| 13 | Follow-up claim pipeline | P2 claims | `contact.ts`, Contacts, rules, export |
| 14 | Log-sheet column templates | P2 templates | LogScan, ocr, contact.ts, export |
| 15 | Guided log capture | P2 capture | LogScan, ocr (heavy) |
| 16 | In-app help videos | P2 help | `App.tsx`, Settings, scan headers |
| 17 | Correction memory / glossary | P2 glossary | rules, teamStorage, Log/Multi, Settings |
| 18 | Multi-language OCR / i18n | P2 i18n | `ocr.ts`, Settings, scan pages |
| 19 | Shared event workspaces | P2 events | App, rules, WorkspaceContext, Contacts, Home |
| 20 | Merge-order doc (this file) | Meta | `docs/pr-merge-order.md` — anytime |
| 21 | Accuracy sample gallery | P0 trust content | `/accuracy`, Auth/Legal/Settings links, SVG placeholders |
| 22 | Sentry + funnel analytics | P1 observability | `package.json`, `main.tsx`, sentry/observability, AuthContext, ocr, Settings |
| 23 | Accessibility pass | P2 a11y | App, Auth, Home, Contacts, LogScan, Scan |
| 24 | Landing ↔ `/accuracy` nav | P0 polish | **Stacks on #3** (`Landing.tsx` + App/Auth). Also carries gallery assets overlapping **#21** — prefer merge **#3 → (#21 or absorb) → #24**, or treat #24 as superseding #21 if files duplicate |
| 25 | Pro priority support mailto | P1 support | `SUPPORT.md`, ContactSupportModal, Settings |
| 26 | Stripe Event pack SKU | P2 billing+events | **Stacks on #19 + #4** — webhook/checkout, events API, rules/indexes, WorkspaceContext |
| 27 | Go-live checklist | Meta | `docs/go-live-checklist.md` — anytime with #20/#1 |
| 28 | Firebase magic-link sign-in | P1 auth | `AuthContext`, `Auth.tsx` — after **#5** (trust/Auth) to reduce Auth conflicts |

---

## Conflict hotspots (updated)

| File | Extra owners beyond earlier table | Risk |
|------|-----------------------------------|------|
| `src/pages/Settings.tsx` | +21, 22, 25 | Very high |
| `src/App.tsx` | +21, 23, 24, 26 | High — landing → gallery → a11y → events |
| `src/contexts/AuthContext.tsx` | +22, 26, 28 | High — Stripe → trust → Sentry → event pack → magic link |
| `src/pages/Auth.tsx` | +21, 23, 24, 28 | High |
| `src/pages/Landing.tsx` | **#3, #24** | **#24 stacks on #3** — merge #3 first, rebase #24 |
| `api/stripe-webhook.ts` / checkout | **#4, #26** | #26 after #4 |
| `firestore.rules` | +19, 26 | Claims → glossary → events → event-pack |
| `src/pages/LogScan.tsx` | +23 | Still highest with OCR stack |
| `package.json` | +22 | After #2/#5/#6 |

---

## Recommended phases

### Phase A — P0 sell / trust / story

```
#20 / #27 / #1 (docs anytime)
→ #4 Stripe
→ #5 Trust
→ #3 Landing
→ #21 Accuracy gallery   (if still separate from #24)
→ #24 Accuracy nav       ← STACKS ON #3 (and needs /accuracy route from #21 or bundled assets)
→ #2 Tests
→ #6 Accuracy scaffold
```

**#24 note:** Branch includes `Landing.tsx` + accuracy gallery files. Land **#3 first**, then rebase **#24**. If #21 and #24 both open with overlapping `public/accuracy-samples/*` / `AccuracyGallery.tsx`, merge one and close/rebase the other to avoid duplicate asset commits.

### Phase B — P1 retention / conversion / ops

```
#10 Upgrade UX
→ #28 Magic-link auth          (after #5; before more Auth churn)
→ #9 Onboarding
→ #8 Sheets + CRM
→ #7 Realtime sync
→ #11 OCR confidence
→ #22 Sentry + analytics       (after #6 observability scaffold / package.json)
→ #25 Priority support mailto  (Settings; after trust support-email decision)
```

### Phase C — P2 differentiators (serialize LogScan / rules / App)

```
#12 Claim admin → #13 Follow-up
→ #16 Help
→ #15 Guided capture → #14 Templates
→ #18 i18n
→ #17 Glossary
→ #23 Accessibility            (wide UI; after Auth/Home/Landing chrome stable)
→ #19 Event workspaces
→ #26 Stripe Event pack        ← STACKS ON #19 + #4 (webhook/checkout/rules)
```

---

## Per-hotfile order (cheat sheet)

- **`AuthContext`:** `#4` → `#5` → `#10` → `#8` → `#22` → `#28` → `#26`
- **`Auth.tsx`:** `#5` → `#3` → `#21`/`#24` → `#23` → `#28`
- **`Landing.tsx`:** `#3` → `#24`
- **`App.tsx`:** `#3` → `#16` → `#21`/`#24` → `#23` → `#19` → `#26`
- **`Settings`:** `#4` → `#5` → `#3` → `#10` → `#9` → `#8` → `#16` → `#21` → `#22` → `#25` → `#18` → `#17` → `#19`/`#26`
- **`LogScan`:** `#3` → `#9` → `#8` → `#11` → `#15` → `#14` → `#16` → `#18` → `#17` → `#23`
- **`ocr.ts`:** `#5` → `#6` → `#11` → `#15` → `#14` → `#18` → `#22`
- **`firestore.rules`:** `#12` → `#13` → `#17` → `#19` → `#26`
- **Stripe APIs:** `#4` → `#26`
- **`package.json`:** `#5` → `#2` → `#6` → `#22`

---

## Merge ritual

1. Review → mark ready when intentional.  
2. `git fetch origin main && git rebase origin/main` on the PR branch.  
3. Fix conflicts; run `tsc` / tests.  
4. Merge with one consistent strategy.  
5. Rebase the **next** PR.  
6. `UNSTABLE` → check Vercel pending before assuming git conflicts.

---

## Intentionally not merging yet

- No automatic merge train without Earl.  
- **#24 stacks on #3** — never merge #24 before #3.  
- **#26 stacks on #19 and #4** — never before Stripe lifecycle + event workspaces.  
- `#14`+`#15` remain the hottest LogScan pair.  
- Meta docs **#20** / **#27** / **#1** can merge any time without blocking product.

---

## Quick reference — one-line order

```
#20/#27/#1 (docs) → #4 Stripe → #5 Trust → #3 Landing → #21 Gallery → #24 Accuracy nav (on #3)
→ #2 Tests → #6 Accuracy scaffold
→ #10 Upgrade → #28 Magic link → #9 Onboarding → #8 Sheets → #7 Realtime → #11 Confidence
→ #22 Sentry → #25 Priority support
→ #12 Claim admin → #13 Follow-up → #16 Help → #15 Guided → #14 Templates
→ #18 i18n → #17 Glossary → #23 a11y → #19 Events → #26 Event-pack Stripe
```
