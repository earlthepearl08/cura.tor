# Vercel Deployment Setup

## Setting up the Gemini API Key

Your Gemini API key is now securely stored on the server. Users won't need to enter their own API key - they'll all use yours.

### Steps to add your API key to Vercel:

1. **Go to your Vercel project settings**
   - Visit: https://vercel.com/dashboard
   - Select your project: `cura-tor`
   - Go to "Settings" tab

2. **Add Environment Variable**
   - Click "Environment Variables" in the left sidebar
   - Add a new variable:
     - **Name**: `GEMINI_API_KEY`
     - **Value**: Your Gemini API key (get it from https://makersuite.google.com/app/apikey)
     - **Environment**: Production, Preview, and Development (check all three)
   - Click "Save"

3. **Redeploy**
   - After adding the environment variable, go to "Deployments" tab
   - Click the three dots (...) on your latest deployment
   - Click "Redeploy"
   - This ensures the new environment variable is available

## How it works

- **Before**: Users entered their own Gemini API key in Settings (visible in browser = insecure)
- **Now**: Your API key is stored in Vercel's secure environment variables
  - Users can't see it
  - All requests go through your `/api/gemini` serverless function
  - The function adds your API key before calling Gemini
  - 100% secure and transparent to users

## Testing locally

If you want to test the Gemini Vision feature locally:

1. Create a `.env` file in the project root:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

Note: The `.env` file is gitignored and won't be committed.

## API Usage Limits

Free tier Gemini API provides:
- **1,500 requests per day**
- **1 million requests per month**

For a prototype/demo, this should be more than enough. If you need more, you can upgrade or implement rate limiting.

## Public SEO files

`public/robots.txt` and `public/sitemap.xml` are copied to the site root on build. They list Landing (`/`, `/welcome`), Accuracy (`/accuracy`), and Legal (`/legal`) using the placeholder origin `https://cura-tor.vercel.app`. See **`public/SEO.md`** to update the host for a custom domain.
App-side abuse ceilings and tier quotas for `/api/gemini` and `/api/ocr` are enforced in code (see `api/_lib/scanGuards.ts`). Prefer **paid** Google billing before production traffic.

## Shared API helpers (`api/_lib`)

Auth / rate-limit / tier-quota logic for scan endpoints is shared in `api/_lib/scanGuards.ts` (imported by `api/gemini.ts` and `api/ocr.ts`).

**Vercel bundling constraints** (full notes in `api/_lib/README.md`):

- Paths under `api/` starting with `_` are **helpers**, not HTTP endpoints
- Handlers must use **static relative** imports so Node File Trace includes the module in each function bundle
- Do **not** import `firebase-admin/auth` on this project (use `jose` + JWKS instead)
