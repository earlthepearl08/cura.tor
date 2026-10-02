# Lighthouse performance budgets (Landing)

Advisory Lighthouse CI for Cura.Tor’s **public Landing** route, mapped to [TECHNICAL_SPEC.md](../TECHNICAL_SPEC.md) §8.

## What it measures

| Config URL | Intent |
|------------|--------|
| `/` | Public Landing (marketing). On `main` today this may redirect to `/auth` until Landing merges. |
| `/welcome` | Landing alias used by marketing PRs |

Budgets (soft / warn-only):

| Spec §8 | Budget |
|---------|--------|
| FCP | &lt; 1.5s |
| LCP | &lt; 2.5s |
| TTI (`interactive`) | &lt; 3.5s |
| CLS | &lt; 0.1 |
| FID proxy (`max-potential-fid` / TBT) | &lt; 100ms / TBT &lt; 300ms |
| Script / CSS transfer | soft caps (see `lighthouserc.cjs`) |

Assertions are **`warn`**, not `error`. GitHub Actions runs `scripts/lighthouse-advisory.sh`, which **always exits 0** and emits `::warning::` annotations for budget misses (so the check stays green — unlike `continue-on-error`, which still shows red).

## Prerequisites

```bash
npm install
npm run build
```

Chrome/Chromium is required (`@lhci/cli` downloads Chrome for Testing on first run when needed).

## Run locally

```bash
# Build once, then collect + assert + write reports to .lighthouseci/
npm run lighthouse

# CI-equivalent (always exit 0; prints warning-style summary):
npm run build && bash scripts/lighthouse-advisory.sh

# Or step-by-step:
npm run build
npx --yes @lhci/cli@0.14.0 autorun --config=./lighthouserc.cjs
```

Open HTML reports under `.lighthouseci/` after a run.

### Against a running preview

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# other terminal:
LHCI_NO_START_SERVER=1 npx --yes @lhci/cli@0.14.0 collect --url=http://127.0.0.1:4173/ --config=./lighthouserc.cjs
npx --yes @lhci/cli@0.14.0 assert --config=./lighthouserc.cjs
```

## CI (optional / advisory)

Workflow: `.github/workflows/lighthouse-advisory.yml`

- Triggers: `workflow_dispatch`, and pull requests that touch app/shell/config
- **Always-green check** — collect/assert failures become annotations + log lines; exit code is always 0
- Uploads `.lighthouseci` reports as an artifact
- Budgets remain documented in `lighthouserc.cjs` and the table above

Enable as a required hard gate only after Landing is on `main` and scores are stable (would need a separate non-advisory workflow).

## Notes

- No fake offline OCR or app-auth flows are audited here — public Landing only.
- Spec §8.2 “Initial JS &lt; 100KB gzipped” is aspirational for the current Vite/React + Firebase client; transfer soft caps in config are intentionally looser until a dedicated bundle budget pass.
- For mobile emulation, change `formFactor` / `screenEmulation` in `lighthouserc.cjs` (desktop preset is used for CI stability).
