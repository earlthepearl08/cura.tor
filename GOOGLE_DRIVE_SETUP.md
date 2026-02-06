# Google Drive Cloud Sync Setup

## Overview
CURA.TOR now supports automatic cloud backup and sync via Google Drive. Your contacts are automatically saved to your Google Drive and can be accessed from any device.

## Setup Steps

### 1. Create Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. Enable **Google Drive API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth Client ID:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth Client ID"
   - If prompted, configure OAuth consent screen first
   - Application type: **Web application**
   - Name: `Cura.tor PWA`
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for local development)
     - `https://cura-tor.vercel.app` (for production)
   - Authorized redirect URIs: (leave empty for now)
   - Click "Create"
5. Copy the **Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)

### 2. Configure Environment Variables

#### Local Development
Add to `.env`:
```bash
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

#### Production (Vercel)
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: Your Google OAuth Client ID
   - **Environment**: Production, Preview, Development (select all)
3. Click "Save"
4. Redeploy your project

### 3. Configure OAuth Consent Screen (Required)

1. Go to "APIs & Services" → "OAuth consent screen"
2. User Type: **External**
3. Fill in required fields:
   - App name: `Cura.tor`
   - User support email: your email
   - Developer contact: your email
4. Scopes: Add `https://www.googleapis.com/auth/drive.file`
5. Test users: Add your email (for testing)
6. Save and Continue

### 4. Using Google Drive Sync

Once configured:

1. **Connect**: Go to Settings → Cloud Backup → "Connect Google Drive"
2. **Sign in**: Authorize with your Google account
3. **Auto-sync**: Contacts automatically sync when you save/edit them
4. **Manual sync**: Click "Sync Now" button in Settings
5. **Restore**: Contacts automatically load when you sign in on a new device

## How It Works

- **Storage**: Contacts saved as `cura-tor-contacts.json` in your Google Drive
- **Privacy**: Only this app can access this file (App Data folder)
- **Sync**: Automatic on connect, manual sync available
- **Offline**: Local IndexedDB continues working offline
- **Multi-device**: Sign in on multiple devices to keep them in sync

## Troubleshooting

### "Not configured" error
- Check that `VITE_GOOGLE_CLIENT_ID` is set in your `.env` file (local) or Vercel environment variables (production)
- Rebuild the app after adding the environment variable

### "OAuth consent screen not configured"
- Complete the OAuth consent screen setup in Google Cloud Console
- Add your email as a test user

### "Access blocked: Authorization Error"
- Make sure you've enabled Google Drive API
- Check that authorized origins include your domain
- Verify OAuth consent screen is configured

### "Failed to sync"
- Check browser console for detailed error
- Ensure you're signed in
- Try disconnecting and reconnecting

## Notes

- **Free**: Google Drive API is free for personal use
- **Quota**: 1 billion requests/day (more than enough)
- **Security**: OAuth 2.0 standard authentication
- **Privacy**: Only your app data, not access to entire Drive
