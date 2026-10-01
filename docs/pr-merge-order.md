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

## Inventory (#1–#42)

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
| 21 | Accuracy sample gallery | P0 trust content | **Superseded as a standalone merge by #24** (see stack note below). Tip `0388eaa` is an ancestor of #24. Files = strict subset of #24. |
| 22 | Sentry + funnel analytics | P1 observability | `package.json`, `main.tsx`, sentry/observability, AuthContext, ocr, Settings |
| 23 | Accessibility pass | P2 a11y | App, Auth, Home, Contacts, LogScan, Scan |
| 24 | Landing + accuracy gallery + nav | P0 landing+trust | **Merge stack:** includes **#3** (`6a375f8`) + **#21** (`0388eaa`) + nav commits. Unique vs #21: primarily `Landing.tsx` accuracy links (+ README note). |
| 25 | Pro priority support mailto | P1 support | `SUPPORT.md`, ContactSupportModal, Settings |
| 26 | Stripe Event pack SKU | P2 billing+events | **Stacks on #19 + #4** — webhook/checkout, events API, rules/indexes, WorkspaceContext |
| 27 | Go-live checklist | Meta | `docs/go-live-checklist.md` — anytime with #20/#1 |
| 28 | Firebase magic-link sign-in | P1 auth | `AuthContext`, `Auth.tsx` — after **#5** (trust/Auth) to reduce Auth conflicts |
| 31 | Friendly OCR 429/5xx errors | P1 OCR UX | Ready for review. `ocr.ts`, Scan/Upload/Log/Multi, `friendlyScanError.ts` — after **#11** confidence; near **#22** observability |
| 32 | Stripe webhook Vitest fixtures | P0 tests | Ready for review. Webhook handler tests + fixtures — **after #4** (handler) and **#2** (Vitest scaffold); may overlap `package.json` / test harness with #2 |
| 33 | Legal subprocessors + Privacy AI path | P0 trust/docs | Ready for review. `Legal.tsx`, `TECHNICAL_SPEC.md` — **after #5** (Legal trust edits); near **#1** docs (`TECHNICAL_SPEC` overlap — rebase onto #1 if both open) |
| 34 | Settings OCR Advanced disclosure | P1 Settings | Ready for review. Hides OCR engine behind Advanced — `Settings.tsx`, `ocr.ts` — **after #5/#10** Settings stack (before later Settings pile-up) |
| 35 | Email password reset on Auth | **P0** auth | Ready for review. `Auth.tsx`, `AuthContext` — **after #5** Auth trust edits; before #28 magic-link |
| 36 | Synthetic accuracy golden set (30/10) | P0 accuracy | Ready for review. `eval/accuracy/` fixtures + scoring + `HOWTO-REAL-SAMPLES.md` — **after #6** scaffold (Phase A follow-on); separate branch from #6 |
| 37 | Gemini ops / cost monitoring docs | Meta ops | Ready for review. `GEMINI_OPS.md`, `VERCEL_SETUP.md`, `.env.example` (+ light `api/gemini.ts` / `api/ocr.ts` notes) — **anytime with #1 / #20 / #27**; rebase if OCR API PRs land first |
| 38 | Landing SEO meta (OG/title/desc) | P0 landing | Ready for review. `Landing.tsx`, `AccuracyGallery.tsx`, `PageMeta.tsx`, `index.html` — **after #24**; PR base is `cursor/landing-accuracy-nav-link-9334` (stacked on #24) |
| 39 | Drive backup data-loss prompt | P1 retention | Ready for review. Calm dismissible Google Drive backup reminder — `Home.tsx`, `Settings.tsx`, `DriveBackupPrompt.tsx` — **Phase B after #5**; **near #10** (shared Home/Settings) |
| 40 | B2B DPA template stub | P0 trust/docs | Ready for review. `DPA.md`, `public/dpa.md`, `Legal.tsx` — **after #33** Legal subprocessors |
| 41 | Home Log/Multi hero workflows | P1 Home UX | Ready for review. Elevates Log Sheet + Multi-Card on `Home.tsx` — **after #5** Home; **near #10 / #39** |
| 42 | Offline honesty UX | P1 trust UX | Ready for review. Saved contacts work offline; new scans need network — `OfflineStatusBanner`, Auth/Home/Contacts — **after #5**; **near #41** |

---

## Conflict hotspots (updated)

| File | Extra owners beyond earlier table | Risk |
|------|-----------------------------------|------|
| `src/pages/Settings.tsx` | +21, 22, 25, **34**, **39** | Very high — #34 Advanced OCR after #5/#10; #39 Drive backup near #10 |
| `src/App.tsx` | +21, 23, 24, 26 | High — landing → gallery → a11y → events |
| `src/contexts/AuthContext.tsx` | +**35**, 22, 26, 28 | High — Stripe → trust → **password reset** → Sentry → event pack → magic link |
| `src/pages/Auth.tsx` | +**35**, 21, 23, 24, 28 | High — **#35** after #5 |
| `src/pages/Landing.tsx` | **#3 ⊂ #24 → #38** | Prefer merge **#24** then **#38** SEO; do not also merge #21 |
| `api/stripe-webhook.ts` / checkout | **#4, #26** | #26 after #4 |
| `firestore.rules` | +19, 26 | Claims → glossary → events → event-pack |
| `src/pages/LogScan.tsx` | +23 | Still highest with OCR stack |
| `package.json` | +22 | After #2/#5/#6 |

---

## Accuracy gallery / landing stack (#3 · #21 · #24)

Inspected 2026-10-01:

| PR | Tip / vs main | Ancestry |
|----|---------------|----------|
| **#3** landing | `6a375f8` · ahead 1 | base for stack |
| **#21** gallery | `0388eaa` · ahead 1 | **ancestor of #24**; **zero files unique** vs #24 |
| **#24** landing+gallery+nav | ahead 4 | merge-base ancestors: **#3 and #21**; + `81c718b` wire nav, `9aaae50` README note |

**Overlapping paths (identical ownership in both #21 and #24):**  
`public/accuracy-samples/*`, `src/pages/AccuracyGallery.tsx`, `src/data/accuracyGallery.ts`, plus shared touches to `App.tsx`, `Auth.tsx`, `Legal.tsx`, `Settings.tsx`.

**Only in #24 (not in #21):** `src/pages/Landing.tsx` (and the landing stack from #3).

### Correct merge sequence (pick one)

**Preferred — single stack merge**

1. Land Phase A prerequisites (**#4**, **#5**) as usual.  
2. Merge **#24** onto `main` (brings landing + `/accuracy` gallery + nav/footer links together).  
3. Merge **#38** Landing SEO meta **immediately after #24** (PR base `cursor/landing-accuracy-nav-link-9334`; retarget to `main` once #24 lands if needed).  
4. **Close #21** as superseded (do not merge separately).  
5. **Close or skip #3** if #24 already merged (its commit is inside #24); if you want a smaller review first, merge **#3** then **#24** (Git will recognize #3 as already contained).

**Alternative — staged reviews**

1. Merge **#3** (landing only).  
2. Merge **#24** (already contains #21; rebases cleanly if #3 is on main).  
3. Merge **#38** SEO (after #24 is on `main`).  
4. **Never merge #21 after #24** — redundant / conflict theater on gallery assets.  
5. Close #21 when #24 is merged (or earlier, with a PR comment pointing here).

**Do not:** merge #21 and #24 as independent feature PRs expecting additive history — #21 is a strict subset of #24’s commit graph.

No dedicated conflict-fix branch needed; path overlap is ancestry, not divergent edits.

---

## Recommended phases

### Phase A — P0 sell / trust / story

Canonical one-liner (matches `docs/go-live-checklist.md`):

```
#1 → #4 → #5 → #35 → #33 → #40 → #24 → #38 → #2 → #32 → #6 → #36
```

Expanded (meta docs anytime; same product order):

```
#1 Operator runbook   (+ #20 / #27 / #37 anytime)
→ #4 Stripe
→ #5 Trust
→ #35 Password reset (Auth)            ← P0; after #5 Auth
→ #33 Legal subprocessors + Privacy AI ← after #5 Legal; rebase if #1 already edited TECHNICAL_SPEC
→ #40 DPA stub                         ← after #33 Legal (DPA.md + Legal.tsx link)
→ #24 Landing + accuracy gallery + nav ← includes #3 + #21; close #21 (and #3 if unused)
   (alt: #3 then #24; still skip standalone #21 merge)
→ #38 Landing SEO meta                 ← after #24; base branch `cursor/landing-accuracy-nav-link-9334`
→ #2 Tests
→ #32 Stripe webhook Vitest fixtures   ← after #4 handler + #2 Vitest scaffold
→ #6 Accuracy scaffold
→ #36 Synthetic golden set (30/10) + HOWTO-REAL-SAMPLES  ← after #6
```

**#24 note:** Stacked merge of landing (`#3`) + gallery (`#21`) + accuracy nav. See section above.

**#38 note:** SEO title/description/Open Graph for Landing + Accuracy gallery. **Stacks on #24** (PR base `cursor/landing-accuracy-nav-link-9334`). Merge **immediately after #24** onto `main` (or retarget to `main` once #24 lands). Do not merge before #24.

**#32 note:** Lands real webhook handler coverage. Merge **after #4** (needs `api/stripe-webhook.ts`) and **after #2** (Vitest/`TESTING.md` scaffold). If #2 and #32 both touch `package.json` / test setup, rebase #32 onto #2.

**#33 note:** Extends trust/Legal honesty with subprocessors + AI image/retention privacy. Merge **after #5**. If **#1** already landed `TECHNICAL_SPEC.md` fixes, rebase #33 onto that tip before merge.

**#40 note:** B2B DPA template stub + Legal link. Merge **immediately after #33** (shared `Legal.tsx` / subprocessors narrative).

**#35 note:** Password reset is a **P0** trust/auth gap. Merge **immediately after #5** (shared `Auth.tsx` / `AuthContext`). Keep **#28** magic-link later so reset lands first.

**#36 note:** Phase A follow-on — full synthetic golden set (30 cards + 10 PH log sheets) and `HOWTO-REAL-SAMPLES.md`. Merge **after #6** so the eval scaffold/monitoring hooks exist first; rebase onto #6 if both touch `eval/`.

**#37 note:** Ops docs for Gemini billing / rate+cost monitoring (`GEMINI_OPS.md`). Merge **anytime with #1 / #20 / #27**. Light touches to `api/gemini.ts` / `api/ocr.ts` — rebase if those APIs already changed on `main`.

### Phase B — P1 retention / conversion (core five)

Run **after Phase A is on `main`** (especially #5 Trust + #24 landing/gallery). These are already **ready for review**. Merge serially; rebase each onto updated `main`.

| Order | PR | Why this slot | Hot-file conflict notes |
|------:|----|---------------|-------------------------|
| B0a | **#42** Offline honesty UX | Clarify offline: saved contacts OK, new scans need network — after #5 Auth/Home | **Auth**, **Home**, **Contacts**, `OfflineStatusBanner` — **near #41** |
| B0b | **#41** Home Log/Multi hero | Elevate Log Sheet + Multi-Card as primary Home workflows | **Home** only — **after #5**; **near #10 / #39** |
| B0c | **#39** Drive backup prompt | Data-loss / backup nudge on Home+Settings after #5 trust chrome; keep next to conversion UX | **Home**, **Settings**, `DriveBackupPrompt` — land **near #10** |
| B1 | **#10** Free-tier upgrade UX | Conversion UX on Home/Settings/AuthContext before more Settings rows pile up | **Settings**, **Contacts**, Home, Scan/Upload, AuthContext, UpgradePrompt |
| B2 | **#9** First-run onboarding | Tip sheets for Log/Multi before export menus and confidence UI rewrite those pages | **LogScan**, **MultiCardScan**, **Settings** (Help/tips entry) |
| B3 | **#8** Sheets + CRM CSV | Export path after AuthContext/Settings from #10; before Contacts claim/realtime churn | **Contacts** (export menu), **LogScan** / MultiCard (export), **Settings**, AuthContext, `export.ts` |
| B4 | **#7** Realtime team sync | Contacts/`teamStorage` listener before claim P2 (#12/#13) | **Contacts**, `teamStorage`, `WorkspaceContext`, TeamAdmin |
| B5 | **#11** OCR confidence review | Field-level review after #9/#8 LogScan touches; before P2 guided/templates (#15/#14) | **LogScan**, `ocr.ts`, ContactReview |

**Core one-liner:** `#42 → #41 → #39 → #10 → #9 → #8 → #7 → #11`

**#42 / #41 / #39 note:** Home cluster after **#5**. Land **#42** offline honesty, then **#41** Log/Multi hero, then **#39** Drive backup next to **#10** upgrade — all share `Home.tsx` (and #42 also Auth/Contacts).

#### Phase B conflict focus (LogScan / Settings / Contacts)

| File | Phase B owners | Guidance |
|------|----------------|----------|
| `src/pages/Settings.tsx` | #39 → #10 → #34 → #9 → #8 | Highest P1 Settings traffic — keep **#39** Drive backup **near #10**; then **#34** Advanced OCR; always rebase next PR after each merge |
| `src/pages/LogScan.tsx` | #9 → #8 → #11 | Onboarding chrome → export menu → confidence/review UI — **do not** parallel-merge these three |
| `src/pages/Contacts.tsx` | #10 → #8 → #7 | Upgrade prompts / export → Sheets/CRM menu → realtime subscription — rebase #7 last among Contacts P1 |
| `src/pages/MultiCardScan.tsx` | #9 → #8 | Same pattern as LogScan (tips then export) |
| `src/contexts/AuthContext.tsx` | #10 → #8 | Upgrade gates then Sheets tier helpers — **#35** password reset is Phase A (after #5); keep #28 magic-link **after** this pair |

#### Phase B follow-ons (still P1, after the core five)

```
#34 Settings OCR Advanced   (after #5/#10 Settings stack; before #9/#8/#22/#25 Settings pile-up if possible — or rebase onto #10)
→ #28 Magic-link auth       (after #5/#35 Auth; prefer after #10/#8 AuthContext calm)
→ #22 Sentry + analytics    (after #6; package.json / ocr / Settings)
→ #31 Friendly OCR errors   (after #11; shared ocr.ts + Scan/Log/Multi — pairs with #22 user-visible failure UX)
→ #25 Priority support      (Settings mailto; after support-email decision from #5)
```

Merge **#34** once **#10** (and #5) Settings edits are on `main`, so Advanced OCR disclosure doesn’t conflict with upgrade UX rows. Merge **#31** after **#11**. Prefer **#22** before or immediately around **#31**.

**Phase B stop condition:** upgrade prompts feel right on free tier; Log/Multi onboarding shows once; Sheets/CRM export works for Pioneer+; team Contacts refresh live; log-sheet review shows field confidence. Then enter Phase C (#12+#13 already ready).

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

- **`AuthContext`:** `#4` → `#5` → `#35` → `#10` → `#8` → `#22` → `#28` → `#26`
- **`Auth.tsx`:** `#5` → `#35` → `#42` → `#3` → `#21`/`#24` → `#23` → `#28`
- **`Landing.tsx`:** `#3` → `#24` → `#38`
- **`Home.tsx`:** `#5` → `#42` → `#41` → `#39` → `#10` → `#23`
- **`App.tsx`:** `#3` → `#16` → `#21`/`#24` → `#23` → `#19` → `#26`
- **`Settings`:** `#4` → `#5` → `#3` → `#39` → `#10` → `#34` → `#9` → `#8` → `#16` → `#21` → `#22` → `#25` → `#18` → `#17` → `#19`/`#26`
- **`LogScan`:** `#3` → `#9` → `#8` → `#11` → `#31` → `#15` → `#14` → `#16` → `#18` → `#17` → `#23`
- **`ocr.ts`:** `#5` → `#6` → `#11` → `#31` → `#34` → `#15` → `#14` → `#18` → `#22`
- **`firestore.rules`:** `#12` → `#13` → `#17` → `#19` → `#26`
- **Stripe APIs:** `#4` → `#32` (tests) → `#26`
- **`package.json`:** `#5` → `#2` → `#32` → `#6` → `#22`
- **`eval/`:** `#6` → `#36`

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
- **#24** is the landing+gallery stack (**includes #3 + #21**) — never merge #21 separately after #24; close #21 as superseded.  
- **#38 stacks on #24** — merge SEO meta only after #24 (retarget to `main` once #24 lands if needed).  
- **#26 stacks on #19 and #4** — never before Stripe lifecycle + event workspaces.  
- `#14`+`#15` remain the hottest LogScan pair.  
- Meta docs **#20** / **#27** / **#1** / **#37** (Gemini ops) can merge any time; **#33** then **#40** wait on **#5** for `Legal.tsx`. **#37** is mostly ops docs — if `#31`/`#6` already changed `api/ocr.ts`, rebase #37 first.

---

## Quick reference — one-line order

```
Phase A: #1 → #4 → #5 → #35 → #33 → #40 → #24 → #38 → #2 → #32 → #6 → #36
  (#20/#27/#37 anytime with #1; #24 includes #3+#21 — close #21; #38 after #24; #40 after #33)
→ Phase B core: #42 offline → #41 Home hero → #39 Drive backup → #10 → #9 → #8 → #7 → #11
→ (#34 OCR Advanced → #28 Magic link → #22 Sentry → #31 Friendly OCR errors → #25 Priority support)
→ #12 Claim admin → #13 Follow-up → #16 Help → #15 Guided → #14 Templates
→ #18 i18n → #17 Glossary → #23 a11y → #19 Events → #26 Event-pack Stripe
```
