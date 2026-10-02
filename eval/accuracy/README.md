# Accuracy golden set (Cura.Tor)

Internal harness for the P0 **accuracy baseline**: field-level extraction quality for calling cards and PH log / sign-in sheets.

## Baseline status

| Set | Target | Shipped |
|-----|--------|---------|
| Calling cards | ≥ 30 | **30 synthetic** JSON fixtures (`synthetic.json` + `expected.json`) |
| PH log sheets | ≥ 10 | **10 synthetic** sheets with multi-row `entries` |

No copyrighted photos are required for mock mode. Real photos are optional for `--live` — see **[HOWTO-REAL-SAMPLES.md](./HOWTO-REAL-SAMPLES.md)**.

## Primary scoring (sellability gate)

Headline metrics use **only**:

1. `name`
2. `company`
3. `phone` (set F1, digit-normalized)
4. `email` (set F1)

`position` / `address` / `notes` are secondary diagnostics. `--fail-under` gates on **primary** accuracy.

## Layout

```
eval/accuracy/
  README.md
  HOWTO-REAL-SAMPLES.md     ← Earl: drop real samples later
  run-eval.mjs
  schema/
  fixtures/cards/<id>/{expected.json,synthetic.json,VISUAL.md[,image.jpg]}
  fixtures/log-sheets/<id>/{expected.json,synthetic.json,VISUAL.md[,image.jpg]}
  mocks/<id>.json
  lib/                      ← normalize, score, prompts, gemini client
  scripts/generate-synthetic-fixtures.mjs
  scripts/score-test.mjs
  results/                  ← generated reports (gitignored)
```

## Commands

```bash
npm run eval:accuracy              # mock — no API key
npm run eval:accuracy:live         # Gemini when image.* present
npm run eval:accuracy:score-test   # scorer unit checks
npm run eval:accuracy:generate     # regenerate synthetic 30/10 set
node eval/accuracy/run-eval.mjs --fail-under 0.85
```

## Relation to production OCR

| Mode | Path |
|------|------|
| App | `ocrService` → `/api/gemini` |
| Eval live | `lib/gemini-client.mjs` + prompts mirrored from `ocr.ts` |
| Eval mock | `mocks/*.json` |

## Privacy

Synthetic contacts are fictional. Do not commit third-party photos without consent — local `image.jpg` + committed `expected.json` is fine.
