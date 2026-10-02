/**
 * Lighthouse CI config for Cura.Tor public Landing route.
 *
 * Budgets align with TECHNICAL_SPEC.md §8 (Performance Requirements).
 * Assertions use "warn" locally. CI never fails the GitHub check:
 * scripts/lighthouse-advisory.sh always exits 0 and emits ::warning:: annotations.
 *
 * Target URL: `/` — Landing page once marketing lands; until then,
 * unauthenticated `/` redirects to `/auth` (still a public entry).
 *
 * @see docs/lighthouse.md
 */
module.exports = {
  ci: {
    collect: {
      // Public Landing (or auth redirect until Landing ships on main)
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/welcome',
      ],
      numberOfRuns: 1,
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 120000,
      settings: {
        // Desktop form factor for CI VM stability; budgets still §8-based.
        formFactor: 'desktop',
        screenEmulation: { disabled: true },
        throttlingMethod: 'simulate',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Soft assertions — advisory budgets from TECHNICAL_SPEC §8.1 / §8.2
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            // Category floors (0–1). Soft: warn only.
            'categories:performance': ['warn', { minScore: 0.7 }],
            'categories:accessibility': ['warn', { minScore: 0.85 }],
            'categories:best-practices': ['warn', { minScore: 0.8 }],
            'categories:seo': ['warn', { minScore: 0.8 }],

            // §8.1 Load time targets (ms)
            'first-contentful-paint': ['warn', { maxNumericValue: 1500 }],
            'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
            interactive: ['warn', { maxNumericValue: 3500 }],
            'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
            // FID proxy in modern Lighthouse
            'total-blocking-time': ['warn', { maxNumericValue: 300 }],
            'max-potential-fid': ['warn', { maxNumericValue: 100 }],

            // §8.2 Bundle size (bytes, transfer) — soft until Landing ships
            'resource-summary:script:size': ['warn', { maxNumericValue: 350000 }],
            'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 80000 }],
          },
        },
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
