# How to add real samples (Earl)

Synthetic fixtures already meet the **≥30 cards + ≥10 PH log sheets** counts for harness wiring and mock scoring. Live Gemini proof still needs real photos dropped in beside the JSON.

## Quick path (replace a synthetic fixture)

1. Pick a fixture folder, e.g. `fixtures/cards/card-010-corp-suffix-only-trap/`.
2. Add a photo named **`image.jpg`** (or `.png` / `.webp`) in that folder.
3. Edit **`expected.json`** so labels match what is actually on the card (keep the same field schema).
4. Optionally refresh the mock after a live run:
   ```bash
   export GEMINI_API_KEY=…
   npm run eval:accuracy:live -- --only card-010-corp-suffix-only-trap
   # copy model output into mocks/card-010-corp-suffix-only-trap.json if you want a regression lock
   ```
5. Re-run mock CI anytime: `npm run eval:accuracy`

## Add a brand-new fixture

### Card

```bash
mkdir -p eval/accuracy/fixtures/cards/card-031-my-sample
# put image.jpg here (optional until live eval)
```

`expected.json`:

```json
{
  "name": "…",
  "company": "…",
  "position": "…",
  "phone": ["…"],
  "email": ["…"],
  "address": "…",
  "notes": "",
  "_meta": {
    "id": "card-031-my-sample",
    "difficulty": "medium",
    "tags": ["ph", "stacked-logo"],
    "notes": "Why this sample matters"
  }
}
```

`mocks/card-031-my-sample.json` — JSON **array** with one contact object (same fields, no `_meta`).

Optional: `synthetic.json` text sketch (already used by generated fixtures) if you do not have a photo yet.

### Log sheet

```bash
mkdir -p eval/accuracy/fixtures/log-sheets/sheet-011-my-event
```

`expected.json`:

```json
{
  "entries": [
    {
      "name": "…",
      "company": "…",
      "position": "…",
      "phone": ["…"],
      "email": ["…"],
      "address": "…",
      "notes": "…"
    }
  ],
  "_meta": {
    "id": "sheet-011-my-event",
    "handwriting": true,
    "difficulty": "hard",
    "tags": ["ph", "handwriting", "trade-show"]
  }
}
```

Mock file = the `entries` array only: `mocks/sheet-011-my-event.json`.

## Scoring (what “accuracy proof” means here)

Headline metrics are **primary fields only**:

| Field | Match rule |
|-------|------------|
| `name` | Case/whitespace-normalized exact string |
| `company` | Same |
| `phone` | Set F1 after digit normalization (suffix match allowed) |
| `email` | Set F1, case-normalized |

`position`, `address`, and `notes` are scored as secondary diagnostics and do **not** gate `--fail-under`.

```bash
npm run eval:accuracy
npm run eval:accuracy:live
node eval/accuracy/run-eval.mjs --fail-under 0.85
npm run eval:accuracy:score-test   # tiny unit checks for the scorer
```

## Diversity checklist for real PH samples

- [ ] ≥10 stacked-logo / multi-line company names  
- [ ] ≥10 multi-phone cards (incl. `/` and fax)  
- [ ] ≥5 credential names (Engr., Atty., Dr., Jr., MBA, …)  
- [ ] ≥5 log sheets with **handwriting** (`"handwriting": true`)  
- [ ] Mix of Makati / BGC / Cebu / province addresses  

## Privacy

Do not commit photos of third parties without consent. Prefer:

- Staff-owned / synthetic cards, or  
- Local-only `image.jpg` (gitignored via your own ignore rules) while committing `expected.json` + mocks.

`synthetic.json` / `VISUAL.md` are enough for mock mode — **no copyrighted stock photos required**.

## Regenerating the synthetic baseline

If you need to rebuild the shipped 30/10 synthetic set from the generator:

```bash
node eval/accuracy/scripts/generate-synthetic-fixtures.mjs
```

This overwrites `expected.json` / mocks / `synthetic.json` for the known ids — commit only if intentional.
