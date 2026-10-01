# Email magic-link (passwordless) sign-in

Passwordless sign-in via Firebase Email Link, alongside Google and email/password.

## App behavior

1. User chooses **Magic link** under “or use email” on `/auth`
2. App calls `sendSignInLinkToEmail` with continue URL `{origin}/auth`
3. Email is stored in `localStorage` (`cura_email_for_sign_in`)
4. User opens the link → lands on `/auth` with Firebase query params
5. App detects `isSignInWithEmailLink`, calls `signInWithEmailLink`
6. If localStorage email is missing (other device), user confirms email once

Google + password flows are unchanged.

## Firebase Console setup

### 1. Enable Email link (passwordless)

1. [Firebase Console](https://console.firebase.google.com) → your project  
2. **Authentication** → **Sign-in method**  
3. Enable **Email/Password** (required base provider)  
4. Enable **Email link (passwordless sign-in)** under the same provider  

### 2. Authorized domains

**Authentication** → **Settings** → **Authorized domains**

Add every host that serves `/auth` as the continue URL, for example:

- `localhost` (local Vite)
- your production domain (e.g. `cura-tor.vercel.app` or custom domain)
- preview hosts if you test magic links on Vercel previews

The continue URL in code is: `` `${window.location.origin}/auth` ``.

### 3. Email template

**Authentication** → **Templates** → **Email address sign-in**

- Customize subject / body for Cura.Tor (optional but recommended for events)
- Ensure the action link stays as Firebase’s `%LINK%` / action URL placeholder
- From-address uses Firebase’s default unless you configure a custom SMTP / custom domain

### 4. (Optional) Dynamic Links / hosting

Modern Firebase Auth email links use the **authDomain** and redirect to your continue URL.  
No separate Dynamic Links project is required for the basic web flow used here (`handleCodeInApp: true` + authorized continue URL).

## Troubleshooting

| Symptom | Check |
|---------|--------|
| “Unauthorized continue URL” | Domain missing from Authorized domains |
| Link opens but asks for email | Opened on a different browser/device — confirm email |
| “invalid-action-code” | Link expired or already used — send a new one |
| Email never arrives | Spam; template enabled; Email link provider on |

## Env

Uses existing `VITE_FIREBASE_*` client config — no new env vars.
