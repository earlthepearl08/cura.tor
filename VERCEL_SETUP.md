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
