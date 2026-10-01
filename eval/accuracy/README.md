# Accuracy golden set (Cura.Tor)

Internal harness for the P0 **accuracy baseline**: measure field-level extraction quality for calling cards and PH log / sign-in sheets against `ocrService` / Gemini prompts.

## Targets

| Set | Minimum | Notes |
|-----|---------|--------|
| Calling cards | **≥ 30** | Mix stacked logos, multi-phone, credentials, PH addresses |
| PH log sheets | **≥ 10** | Include handwritten booth sheets; tabular + messy |

Current fixtures under `fixtures/` are **tiny examples** (2 cards + 2 sheets) so the runner works without real photos (mock mode).

## Layout

```
eval/accuracy/
  README.md                 ← this file
  run-eval.mjs              ← scorer (mock or --live Gemini)
  schema/
    contact.schema.json     ← expected card / row fields
    log-sheet.schema.json   ← expected sheet = { entries: Contact[] }
  fixtures/
    cards/<id>/
      expected.json         ← required (see schema)
      VISUAL.md             ← optional sketch if no photo yet
      image.jpg             ← optional; required for meaningful --live
    log-sheets/<id>/
      expected.json
      VISUAL.md
      image.jpg
  mocks/<id>.json           ← Gemini-shaped array used when not live / no image
  lib/                      ← normalize, score, prompts, gemini client
  results/                  ← generated reports (gitignored)
```

## How Earl should add fixtures

### Cards (≥ 30)

1. Photograph a real card (good lighting, full card in frame). Prefer JPEG.
2. Create a folder: `fixtures/cards/<short-kebab-id>/`
3. Save the photo as `image.jpg` in that folder.
4. Hand-label `expected.json` using the contact schema:

```json
{
  "name": "Engr. Maria Santos, REE, PEE",
  "company": "KINMO PW Corporation",
  "position": "Senior Sales Manager",
  "phone": ["+63 917 555 1234", "8703-5284"],
  "email": ["maria.santos@kinmopw.com"],
  "address": "Main Office: … | Branch: …",
  "notes": "www.example.com",
  "_meta": {
    "id": "card-003-whatever",
    "difficulty": "medium",
    "tags": ["stacked-logo", "ph"],
    "notes": "Why this card is interesting for eval"
  }
}
```

5. Add a matching mock at `mocks/<same-id>.json` — a JSON **array** with one object (same fields, no `_meta`). Start by copying `expected.json` fields; after a live run, replace the mock with the model’s actual output if you want regression locks.
6. Diversify tags: `stacked-logo`, `multi-phone`, `multi-address`, `fax`, `credentials`, `handwriting`, `low-contrast`, `ph`.

### PH log sheets (≥ 10)

1. Photograph full sheets (or multi-page — one image per fixture for now).
2. Folder: `fixtures/log-sheets/<short-kebab-id>/` + `image.jpg`.
3. `expected.json`:

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
    "id": "sheet-003-…",
    "handwriting": true,
    "difficulty": "hard",
    "tags": ["ph", "handwriting", "trade-show"]
  }
}
```

4. Mock file `mocks/<same-id>.json` = the `entries` array only.
5. Aim for ≥ half of the 10 sheets to include **handwriting**; mark `"handwriting": true` in `_meta`.

### Privacy

Do not commit photos of real people/companies without consent. Prefer synthetic or staff-owned cards, or keep sensitive images **out of git** (local-only `image.jpg`) and commit only `expected.json` + mocks.

## Running

```bash
# Offline — scores mocks vs expected (CI-safe, no key)
npm run eval:accuracy

# Live — needs GEMINI_API_KEY and image.* per fixture
export GEMINI_API_KEY=…
npm run eval:accuracy:live

# CI gate example
node eval/accuracy/run-eval.mjs --fail-under 0.85
```

Reports land in `eval/accuracy/results/report-*.json`.

## What “good” looks like

Prioritize **name / company / phone / email** field accuracy. Address and notes are secondary. After ≥30+10 labeled images, use live mode to find top failure modes, then tighten `GEMINI_CORE_RULES` / log prompts in `src/services/ocr.ts` (keep `eval/accuracy/lib/prompts.mjs` in sync).

## Relation to production OCR

| Mode | Path |
|------|------|
| App | `ocrService` → `/api/gemini` (Firebase auth + quota) |
| Eval live | `lib/gemini-client.mjs` → Gemini API directly with the same prompt rules |
| Eval mock | `mocks/*.json` — no network |

This harness does **not** boot the React app; it validates extraction quality against the same schema and prompt rules the product uses.
