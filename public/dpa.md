# Cura.tor — Data Processing Agreement (Template Stub)

**Status:** Template for early B2B customers — **not legal advice**, not a signed agreement, and not a certification of NPC registration or third-party audit.  
**Processor:** Kinmo PW Corporation (“**Processor**”, “we”) operating the Cura.tor service.  
**Controller:** The customer organization using Cura.tor for business purposes (“**Controller**”, “you”).  
**Contact:** support@curator-app.com  

To request an executed DPA, email the contact above with your legal entity name, address, and primary admin email. This stub is the starting point for that conversation; terms may be negotiated before signature.

---

## 1. Scope

Processor provides Cura.tor: AI-assisted scanning and contact management (cards, multi-card sheets, log sheets, optional team workspace). Under this template, Processor processes personal data **on Controller’s documented instructions** as needed to provide the Service.

This stub assumes Controller is the data controller for end-user and scanned contact personal data; Processor acts as a service provider / personal information processor for that processing. Roles may differ if you only use the Service for your own sole-proprietor data — tell us if that applies.

---

## 2. Categories of data & data subjects

| Category | Examples | Typical subjects |
|----------|----------|------------------|
| Account data | Name, email, auth identifiers, tier/usage | Controller’s users (employees/contractors) |
| Contact / lead data | Name, company, title, phone, email, address, notes | Business contacts captured by Controller’s users |
| Scan images | Card / sheet photos sent for OCR/AI extraction | May depict or contain personal data of data subjects |
| Team / org metadata | Org membership, claims, invites (if team features used) | Controller’s users |
| Billing identifiers | Stripe customer / subscription IDs (not full card PAN in our DB) | Controller’s billing contact |

---

## 3. Nature & purpose of processing

- Authenticate users; enforce tiers and quotas  
- Transmit scan images through our hosted API for OCR/AI field extraction and return results to the user  
- Store account/profile and (for team workspaces) shared contact records  
- Optional: Controller-enabled Google Drive App Data backup (personal contacts)  
- Process payments via Stripe when Controller purchases a paid plan  
- Provide support and account deletion when requested  

**Duration:** For the term of the Service relationship and any short retention needed for backups, legal holds, or deletion workflows described in the in-app Privacy Policy.

---

## 4. Subprocessors

Consistent with the in-app Privacy Policy subprocessors list (see also PR / Legal updates for Gemini–Vision–Stripe–Firebase–Vercel). Processor engages:

| Subprocessor | Role |
|--------------|------|
| **Google Gemini** | AI extraction for cards, multi-card, and log sheets (images/prompts via our API) |
| **Google Cloud Vision** | OCR path for text extraction from images sent via our API |
| **Firebase / Google** | Authentication, Firestore (account profile, usage, team/org data) |
| **Google Drive** *(optional)* | Personal contact backup in the user’s Drive App Data when sync is connected |
| **Vercel** | Hosts the web app and serverless API routes that receive scans and call Gemini/Vision |
| **Stripe** | Checkout and customer portal; card data handled by Stripe |

Controller authorizes these subprocessors for the purposes above. Processor will keep the public Privacy Policy / this list reasonably current; material additions should be communicated before reliance for regulated use. Each subprocessor processes under its own terms; international transfers may occur (e.g. Google / Vercel regions).

---

## 5. Security (summary)

Processor uses HTTPS in transit, Firebase Authentication, and scoped access where applicable. This is **not** a guarantee of absolute security and **not** an SOC 2 / ISO certificate claim. Controller should assess fitness for its risk profile (especially before sending sensitive categories of personal data in scans).

---

## 6. Retention & deletion (summary)

- **Personal contacts:** Primarily on the user’s device (IndexedDB); soft-delete tombstones ~30 days then purge  
- **Drive backup:** Until Controller’s user removes it or disconnects sync  
- **Team contacts:** In the org’s Firestore data while the workspace exists  
- **Account profile:** For the life of the account; in-app account deletion removes the user document and related cleanup, then Firebase Auth deletion (owner / team-admin edge cases apply)  
- **Scan images in AI pipelines:** Not retained by Processor as a permanent archive after the request; Google/Vercel may keep operational logs per their policies  
- **Stripe:** Subscription cancel-on-delete may still be incomplete until billing fulfillment is fully wired — flag ongoing charges to support  

Details: in-app **Privacy Policy** (`/legal?tab=privacy`).

---

## 7. Controller responsibilities

- Provide a lawful basis / notices to data subjects for scanning and storing their business contact data  
- Configure team access and exports appropriately  
- Not upload special-category or prohibited data unless a separate written agreement covers it  
- Use account deletion / export tools, or contact support, for erasure requests Processor can fulfill in the Service  

---

## 8. Assistance & incidents

Subject to feasibility and applicable law, Processor will reasonably assist with Controller requests related to access, correction, or deletion **of data Processor holds** in the Service. Security incidents affecting personal data Processor processes for Controller should be reported to the contact above without undue delay after confirmation.

---

## 9. Governing context

Service Terms and Privacy Policy (Philippine Data Privacy Act of 2012 / RA 10173 rights language in-app) apply. This stub does **not** replace counsel review for your jurisdiction or sector.

---

## 10. How to adopt

1. Review subprocessors and processing scope above.  
2. Email **support@curator-app.com** to request a countersigned DPA (entity details + admin email).  
3. Until signed, this document remains a **non-binding template**.

*Last updated: October 1, 2026*
