# Salesforce CSV Export

Cura.Tor can export contacts as a **Salesforce CSV** with Import Wizard–friendly API field headers (`FirstName`, `LastName`, `Company`, …).

This sits alongside the HubSpot-oriented **CRM-ready CSV** / Google Sheets layout from [PR #8](https://github.com/earlthepearl08/cura.tor/pull/8) (`CRM_EXPORT_MAPPING.md`, `src/services/crmExport.ts`).

| Export | Headers | Best for |
|--------|---------|----------|
| CRM-ready CSV (#8) | Human labels (`First Name`, `Company Name`, …) | HubSpot Contacts import; Sheets |
| **Salesforce CSV** (this doc) | Salesforce API names (`FirstName`, `Company`, …) | Salesforce Data Import Wizard / Data Loader |

Tier gate: same paid CSV family as standard export (**Pioneer / Pro / Enterprise**, `canExportCSV`).

Shared implementation: `src/services/salesforceExport.ts` → `exportService.toSalesforceCSV`.

## Column layout

| CSV header | Source | Salesforce object field | Notes |
|------------|--------|-------------------------|-------|
| `FirstName` | `name` (split) | Lead / Contact `FirstName` | Everything before the last whitespace token |
| `LastName` | `name` (split) | Lead / Contact `LastName` | **Required on Lead & Contact.** Fallback: Company → FirstName → `Unknown` |
| `Company` | `company` | Lead `Company` | **Required on Lead.** Fallback: LastName → FirstName → `Unknown`. On Contact import, map to Account Name or skip per your org |
| `Title` | `position` | `Title` | Job title |
| `Email` | `email[0]` | `Email` | Primary email |
| `Phone` | `phone[0]` | `Phone` | Primary / work |
| `MobilePhone` | `phone[1]` | `MobilePhone` | Second number when present |
| `Street` | `address` | `Street` | Free-text card address (not split into City/State/Postal) |
| `Description` | notes + meta | `Description` | Notes, extra emails, folder, batch, claim owner |
| `LeadSource` | constant `Cura.Tor` | `LeadSource` | Add `Cura.Tor` as a picklist value (or map to an existing value) |
| `CuraTor_Contact_Id__c` | `id` | custom External ID (optional) | Create as Text(18) External ID for upsert / dedupe; skip column if unused |

## Data Import Wizard — Leads (recommended for event scans)

1. Setup → **Data Import Wizard** (or App Launcher → Data Import Wizard).
2. **Leads** → Add new records (or update existing if you use External ID).
3. CSV → upload `contacts_salesforce_export_*.csv`.
4. Confirm character encoding **ISO-8859-1** or **UTF-8** to match the file (Cura.Tor writes UTF-8).
5. Map fields (auto-map should hit most API-named headers):

| CSV column | Map to Lead field |
|------------|-------------------|
| FirstName | First Name |
| LastName | Last Name |
| Company | Company |
| Title | Title |
| Email | Email |
| Phone | Phone |
| MobilePhone | Mobile |
| Street | Street |
| Description | Description |
| LeadSource | Lead Source |
| CuraTor_Contact_Id__c | CuraTor Contact Id (custom) — or **Skip** |

6. Start import → review success / error rows in the email notification.

### Lead picklist: Lead Source

If import warns on `LeadSource`, either:

- Setup → Object Manager → Lead → Fields → **Lead Source** → add picklist value `Cura.Tor`, or
- In the Wizard, map `LeadSource` to an existing value (e.g. `Other` / `Trade Show`) and skip the raw column.

## Data Import Wizard — Contacts

Use when records should land on **Contact** (usually with Accounts):

1. Data Import Wizard → **Accounts and Contacts** → Add new records → Contacts (and Accounts as needed).
2. Upload the same Salesforce CSV.
3. Mapping differences vs Leads:

| CSV column | Contact / Account mapping |
|------------|---------------------------|
| Company | **Account Name** (creates/matches Account) or skip if Contacts-only |
| LastName | Last Name (required) |
| FirstName | First Name |
| Title / Email / Phone / MobilePhone / Street / Description | Same-named Contact fields |
| LeadSource | Often **Skip** on Contact (Lead-only field unless you custom-map) |
| CuraTor_Contact_Id__c | Custom External ID on Contact (optional) |

Salesforce Contact does not use `Company` the same way as Lead — Company becomes the related **Account**.

## Data Loader (advanced)

Same headers work with Data Loader `insert` / `upsert` on Lead or Contact.

- For **upsert**, create `CuraTor_Contact_Id__c` as an External ID and select it as the match field.
- Match object API names exactly (`Lead`, `Contact`).
- UTF-8 CSV; quote escaping follows RFC-style doubled quotes.

## Relation to HubSpot CRM CSV (#8)

| Concern | CRM-ready CSV (#8) | Salesforce CSV |
|---------|--------------------|----------------|
| Name split | Yes | Yes (same rules) |
| Lifecycle Stage | `lead` column | N/A (Salesforce uses Lead object / status) |
| Lead Source | `Lead Source` label | `LeadSource` API name |
| Extra emails | Own column | Folded into `Description` |
| Folder / Batch / Claim | Own columns | Folded into `Description` |
| Contact id | `Contact ID` | `CuraTor_Contact_Id__c` |

Prefer **Salesforce CSV** for Salesforce Import Wizard auto-mapping; prefer **CRM-ready CSV** for HubSpot or Google Sheets collaboration.

## In-app flow

1. Contacts → Export → **Salesforce CSV**.
2. Optional: multi-select contacts first; otherwise the current filtered list exports.
3. Import the downloaded file in Salesforce as above.
