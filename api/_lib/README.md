# `api/_lib` — shared serverless helpers

Shared code for Vercel Node functions under `/api`.

## Vercel constraints (why this layout)

1. **Underscore prefix** — Files/folders under `api/` that start with `_` are **not** turned into HTTP endpoints. Without `_`, a file like `api/lib/foo.ts` would deploy as `/api/lib/foo`.
2. **Relative imports only** — Handlers must import with a static relative path (e.g. `import { verifyAuth } from './_lib/scanGuards'`). Vercel’s Node File Trace includes those dependencies in each function bundle. Path aliases (`@/…`) are not used here and may not resolve in the serverless build.
3. **No `firebase-admin/auth`** — On this project, `firebase-admin/auth` fails to bundle (`FUNCTION_INVOCATION_FAILED`). Use `jose` + Google’s JWKS (see `verifyAuth`) and `firebase-admin/firestore` for Admin SDK writes.
4. **No dynamic import of helpers** — Prefer static `import` so NFT can see the dependency graph. Dynamic `import()` of helper paths can leave code out of the deploy bundle.

Historically `api/ocr.ts` and `api/gemini.ts` inlined the same auth/rate/quota helpers because of a bundling scare. The supported pattern is this `_lib` module with the rules above — not infinite duplication.

## Contents

| Module | Used by |
|--------|---------|
| `scanGuards.ts` | `api/gemini.ts`, `api/ocr.ts` — JWT verify, abuse rate limits, tier scan quota |
