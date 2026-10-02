# Priority support — shared inbox (Earl)

Pro sells **Priority support**. The app fulfills that with a real email path — not a full ticketing product.

## Public address

**`support@curator-app.com`**

Used in:
- `src/config/support.ts` (`SUPPORT_EMAIL`)
- Settings → Support
- In-app Contact support mailto handoff
- Legal contact sections

If you change the address, update `SUPPORT_EMAIL` and Legal in the same PR. Confirm DNS/mailbox ownership before advertising widely.

## Soft SLA (shown in-app)

> Pro & Enterprise: we aim to reply within 1 business day (PH time).

This is **operational guidance**, not a contractual SLA, until you publish terms. Adjust copy in `PRIORITY_SUPPORT_SLA` (`src/config/support.ts`) when you lock a real target.

## Shared inbox setup (recommended)

1. **Create / claim** `support@curator-app.com` (Google Workspace alias, group, or catch-all → your inbox).
2. **Google Group (simple shared inbox)**  
   - Create group `support@…`  
   - Allow external senders  
   - Add you (+ anyone who should reply) as members  
   - Conversation history on  
3. **Gmail filters** for app-generated subjects:
   - `[PRIORITY]` → label `Priority` + star (Pro / Enterprise)
   - `[SUPPORT]` → label `Support`
   - `[OCR]` / `[BILLING]` / … → optional sub-labels (category from the form)
4. **Response template** (example): acknowledge + ask for device / sheet photo if OCR; for billing, ask Stripe receipt email.

## Mailto handoff (what the app sends)

The Contact support form opens the user’s mail client with:

```
Subject: [PRIORITY] [OCR] <user subject>
Body: message + tier, account email, page URL, user agent
```

No server-side ticket store. If mailto fails (some in-app browsers), users can copy the address from Settings.

## Optional later upgrades

| Option | When |
|--------|------|
| Zendesk / Front / Help Scout | Volume > ~20 tickets/week or need SLAs/macros |
| `api/support.ts` → Creates Zendesk ticket | Want in-app submit without mail client |
| Status page | Recurring OCR/API outages |

Until then, mailbox + labels is enough to honestly sell Priority support.

## Smoke check

1. Sign in as Pro (or temporarily set tier) → Settings → **Priority support** → Contact support  
2. Confirm mailto opens with `[PRIORITY]` in the subject  
3. Free user → Settings → Contact support → subject uses `[SUPPORT]`  
4. Reply from the shared inbox and confirm the customer receives it  
