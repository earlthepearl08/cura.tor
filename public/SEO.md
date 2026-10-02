# Public SEO files

Static crawler files served from the site root (Vite `public/` → build output):

| File | URL |
|------|-----|
| `robots.txt` | `/robots.txt` |
| `sitemap.xml` | `/sitemap.xml` |

## Placeholder origin

Both files currently use:

```text
https://cura-tor.vercel.app
```

That matches the production host noted in `GOOGLE_DRIVE_SETUP.md`. Before a custom domain launch, replace that origin in:

- `Sitemap:` line in `robots.txt`
- every `<loc>` in `sitemap.xml`
- canonical / Open Graph URLs in `index.html` (and any `PageMeta` site constant, if present)

There is no build-time `VITE_SITE_URL` injection yet — update these files (or add an env-driven generate step later) when the canonical host changes.

## Covered public routes

- `/` — Landing
- `/welcome` — Landing (alias)
- `/accuracy` — Accuracy sample gallery
- `/legal` — Terms & Privacy

Authenticated app routes are listed under `Disallow` in `robots.txt` so they are not treated as marketing entry points.
