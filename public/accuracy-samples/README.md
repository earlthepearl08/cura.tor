# Accuracy sample gallery assets

Public marketing trust examples for `/accuracy`.

## Current state

Files ending in `.svg` are **placeholders** (labeled in-image). Structured “after” fields live in `src/data/accuracyGallery.ts` and match eval harness IDs from the accuracy monitoring work (`card-001-stacked-logo`, etc.).

## How Earl swaps in real photos

1. Add a real photo next to the placeholder, same basename:
   - `card-001-stacked-logo.jpg` (or `.png` / `.webp`)
   - `card-002-multi-phone.jpg`
   - `sheet-001-ph-signin.jpg`
   - `sheet-002-handwritten-mix.jpg`
2. In `src/data/accuracyGallery.ts`, for that sample:
   - set `imageSrc` to the new file, e.g. `'/accuracy-samples/card-001-stacked-logo.jpg'`
   - set `imageIsPlaceholder: false`
3. Optionally refresh `extracted` fields from `eval/accuracy/fixtures/.../expected.json` so gallery and scoring stay aligned.
4. Prefer photos you have rights to publish (blur badges/faces if needed). Keep files under ~500KB each (compress before commit).
5. Keep the SVG placeholders until the photo is ready — do not delete until swapped.

## Landing / help links

- Public route: **`/accuracy`**
- Linked from Auth + Legal footers, Settings → Legal & trust, and the public Landing header/footer (`Landing.tsx`).
- With the marketing landing routes, signed-in Home lives at **`/app`** (not `/`). Auth redirect and Settings back-nav already use `/app`; gallery brand mark points at `/` (landing).
