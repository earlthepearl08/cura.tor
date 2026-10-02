# Vercel Deployment Setup

## Setting up the Gemini API Key

Your Gemini API key is stored on the server. Users don't enter their own key — all OCR traffic goes through `/api/gemini` (and optionally `/api/ocr` for Cloud Vision).

### Steps to add your API key to Vercel:

1. **Go to your Vercel project settings**
   - Visit: https://vercel.com/dashboard
   - Select your project: `cura-tor`
   - Go to "Settings" tab

2. **Add Environment Variable**
   - Click "Environment Variables" in the left sidebar
   - Add a new variable:
     - **Name**: `GEMINI_API_KEY`
     - **Value**: Your Gemini API key (from https://aistudio.google.com/apikey)
     - **Environment**: Production, Preview, and Development (check all three)
   - Click "Save"
   - Optional: also set `GOOGLE_API_KEY` if you use Cloud Vision via `/api/ocr`

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
  - Auth + per-uid rate limits + tier quotas are enforced server-side

## Testing locally

If you want to test the Gemini Vision feature locally:

1. Create a `.env` file in the project root:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

2. Run the development server (`npm run dev` for the SPA; use `npx vercel dev` to exercise `/api/*`).

Note: The `.env` file is gitignored and won't be committed.

## Production billing & monitoring (required before paid traffic)

**Do not rely on free-tier Gemini quotas for Pro / log-sheet promotion.** Free limits will return **429** under real multi-user load.

See **`GEMINI_OPS.md`** for:

<<<<<<< /tmp/meld/37-main-VERCEL_SETUP.md
For a prototype/demo, this should be more than enough. If you need more, you can upgrade or implement rate limiting.

## Public SEO files

`public/robots.txt` and `public/sitemap.xml` are copied to the site root on build. They list Landing (`/`, `/welcome`), Accuracy (`/accuracy`), and Legal (`/legal`) using the placeholder origin `https://cura-tor.vercel.app`. See **`public/SEO.md`** to update the host for a custom domain.
=======
- Paid Google AI billing checklist (budget alerts, kill-switch)
- How to watch **429 / 5xx** in Vercel logs
- Rough **cost-per-scan** notes for `gemini-2.5-flash`
- Where in-app rate-limit / quota UX surfaces (incl. PR [#31](https://github.com/earlthepearl08/cura.tor/pull/31))
>>>>>>> /tmp/meld/37-pr-VERCEL_SETUP.md
