/**
 * Prompt snippets mirrored from src/services/ocr.ts (GEMINI_CORE_RULES + log/multi prompts).
 * Keep in sync when OCR prompts change — eval live mode uses these against Gemini Vision.
 */

export const GEMINI_CORE_RULES = `## Extraction Rules

1. "name" MUST be the PERSON's full name (first + last), including any professional credentials/designations (e.g., "Dr. John Smith, MD, PhD", "Engr. Maria Santos, REE, PEE, MSEE"). Include prefixes (Dr., Engr., Atty., Arch.) and suffixes (MD, PhD, CPA, REE, PEE, PE, MBA, MSEE, RN, DDS, Esq., Jr., Sr., III). If credentials appear on a SEPARATE line from the name, combine them into the name field. Never put a company name, brand, tagline, or abbreviation in the name field.

2. "company" is the registered business entity name.
   - **Stacked logo names**: Company names are often stylized as a stacked logo where the brand is on one line and the entity suffix is on a separate line below it (e.g., "KINMO PW" on one line and "CORPORATION" on the next, or "ACME" above "INDUSTRIES INC."). OCR will return these as separate text lines. You MUST recombine them into the full company name. Use the image to confirm which adjacent lines belong together as one logo.
   - Prefer the LONGEST complete form. NEVER return just an entity suffix alone (never return "Corporation", "Inc.", "Ltd.", "Corp." by itself — if you're tempted to, you missed the brand name above or below).
   - Entity suffixes to recognize: Inc., Ltd., Corp., Corporation, LLC, Pte Ltd, Co., Company, Holdings, Group, Enterprises, Industries, Solutions, Services, Technology, Technologies.

3. "position" is the person's job title or role (e.g., "Senior Sales Manager", "VP of Sales & Marketing"). Department names alone are NOT positions unless combined with a title.

4. "phone" is an ARRAY of phone number strings. Each number is a SEPARATE entry.
   - Numbers separated by "/", "|", spaces, or commas on the same line are DIFFERENT numbers — split them. Never merge two numbers into one entry. "8703-5284 / 8362-5820" is TWO entries.
   - Include country codes when visible, prefix with "+".
   - Include ALL numbers (mobile, office, direct, landline, fax). Label fax with "(Fax)" suffix.
   - Preserve the original formatting (dots, dashes, spaces) within each number.

5. "email" is an ARRAY of email address strings. Include ALL emails found, each as a separate entry.

6. "address" is a single string.
   - **Multiple labeled addresses**: If multiple labeled addresses are visible (e.g., "Main Office", "Branch", "Showroom", "BGC Office", "Head Office", "Warehouse", "Factory"), include ALL of them. Format: \`Label: address content | Label: address content\`. Use \` | \` (space-pipe-space) between addresses and \`: \` between label and content. Preserve labels exactly as shown.
   - For a single unlabeled address, output the address as-is with no label prefix.
   - Within each address, combine multi-line content (street, city, zip, country) into one string using commas.

7. "notes" is a single string for useful information that does not fit the other fields:
   - Website URLs (www.example.com)
   - Social media URLs (facebook.com/..., linkedin.com/in/...)
   - Taglines or slogans visible on the card
   - Any other context worth keeping
   - Separate multiple items with \` | \`. Return empty string "" if nothing.

8. If a field cannot be determined, use empty string "" for strings or [] for arrays.

9. Do NOT invent or guess information that is not present in the text or visible in the image.`;

export const CONTACT_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      company: { type: 'STRING' },
      position: { type: 'STRING' },
      phone: { type: 'ARRAY', items: { type: 'STRING' } },
      email: { type: 'ARRAY', items: { type: 'STRING' } },
      address: { type: 'STRING' },
      notes: { type: 'STRING' },
    },
    required: ['name', 'company', 'position', 'phone', 'email', 'address', 'notes'],
  },
};

export function cardPrompt() {
  return `You are an expert business card data extractor. This image contains ONE business card.

## Task
Extract the person's contact information from the card.

${GEMINI_CORE_RULES}

Return ONLY a JSON array with a single object. No explanation, no markdown.`;
}

export function logSheetPrompt() {
  return `You are an expert data extractor specializing in event log sheets and sign-in sheets. This image is a log sheet / sign-in sheet from an event, conference, or trade show. Each ROW in the sheet represents a DIFFERENT person who signed in.

## Task
1. Identify the table/grid structure in the image.
2. Identify column headers (they may be: Name, Company, Position/Title, Phone, Email, Address, Purpose/Notes, etc.).
3. For EACH row (each person), extract the data into the corresponding fields.
4. If a column doesn't exist in the sheet, leave that field as an empty string or empty array.
5. Skip any empty rows or header rows.
6. Handle handwritten text as best you can — if unclear, make your best guess.
7. Each row MUST be a separate entry in the output array.
8. Do NOT merge data from different rows into one entry.

${GEMINI_CORE_RULES}

Return ONLY a JSON array of objects. No explanation, no markdown.`;
}
