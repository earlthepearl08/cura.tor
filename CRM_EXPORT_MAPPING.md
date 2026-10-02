# CRM & Google Sheets Export Mapping

Cura.Tor exports contacts in a **CRM-ready column layout** used by both:

1. **CRM-ready CSV** (file download)
2. **Google Sheets** (one-click create + open spreadsheet)

Tier gate: **Pioneer / Pro / Enterprise** (`TIER_LIMITS.googleSheetsExport`, same paid export family as CSV/Excel).

## Column layout

| Column | Source field | Notes |
|--------|--------------|-------|
| First Name | `name` (split) | Everything before the last whitespace token |
| Last Name | `name` (split) | Last whitespace token; empty if single-token name |
| Email | `email[0]` | Primary email for HubSpot/Salesforce identity |
| Additional Emails | `email[1…]` | Semicolon-separated |
| Phone | `phone[0]` | Primary / work phone |
| Mobile Phone | `phone[1]` | Second number when present |
| Company Name | `company` | HubSpot `company` / Salesforce `Company` |
| Job Title | `position` | HubSpot `jobtitle` / Salesforce `Title` |
| Street Address | `address` | Free-text address from card/sheet |
| Notes | `notes` | User notes / inquiry context |
| Lifecycle Stage | constant `lead` | HubSpot-friendly default |
| Lead Source | constant `Cura.Tor` | Attribution for CRM imports |
| Folder | `folder` | Local organization folder |
| Batch | batch name via `batchId` | Scan batch label when available |
| Claimed By | `claimedByName` | Team dibs / claim owner |
| Scanned At | `createdAt` | ISO-8601 |
| Updated At | `updatedAt` | ISO-8601 when set |
| Contact ID | `id` | Stable Cura.Tor id for re-import / dedupe |

Shared implementation: `src/services/crmExport.ts`.

## HubSpot Contacts import

1. Contacts → Import → File from computer → start with one file.
2. Map columns approximately as:

| Cura.Tor column | HubSpot property |
|-----------------|------------------|
| First Name | First Name |
| Last Name | Last Name |
| Email | Email |
| Additional Emails | (skip or custom) |
| Phone | Phone Number |
| Mobile Phone | Mobile Phone Number |
| Company Name | Company Name |
| Job Title | Job Title |
| Street Address | Street Address |
| Notes | Message / Notes |
| Lifecycle Stage | Lifecycle Stage (`lead`) |
| Lead Source | Lead Source (`Cura.Tor` or create option) |
| Contact ID | custom property (optional) |

## Salesforce Leads / Contacts

| Cura.Tor column | Salesforce field |
|-----------------|------------------|
| First Name | FirstName |
| Last Name | LastName (required on Lead — use Company if blank) |
| Email | Email |
| Phone | Phone |
| Mobile Phone | MobilePhone |
| Company Name | Company (required on Lead) |
| Job Title | Title |
| Street Address | Street |
| Notes | Description |
| Lead Source | LeadSource (`Cura.Tor` picklist value recommended) |
| Contact ID | External ID custom field (optional) |

## Google Sheets setup

Uses the same `VITE_GOOGLE_CLIENT_ID` as Drive sync (GIS token client).

1. In [Google Cloud Console](https://console.cloud.google.com/) enable **Google Sheets API** (in addition to Drive API if already enabled for sync).
2. OAuth consent screen: add scope `https://www.googleapis.com/auth/spreadsheets`.
3. Keep authorized JavaScript origins the same as Drive (`localhost:5173`, production domain).

### In-app flow

1. Contacts (or Multi-Card / Log Sheet export) → **Google Sheets**.
2. Google OAuth consent (spreadsheets scope) if not already granted for Sheets.
3. App creates `Cura.Tor Contacts YYYY-MM-DD` with a frozen header row and CRM columns.
4. Spreadsheet opens in a new tab.

Drive App Data sync (`drive.appdata`) remains separate; Sheets export creates a **user-visible** spreadsheet in My Drive.
