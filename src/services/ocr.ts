// @ts-ignore - Types available after npm install
import { createWorker } from 'tesseract.js';
import { auth } from '../config/firebase';

async function authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Shared parsing rules used by all Gemini flows (single card, multi-card, log sheet).
// Keeps stacked logo / multi-address / phone-splitting / notes handling consistent
// across entry points so no flow silently runs on stale prompt logic.
const GEMINI_CORE_RULES = `## Extraction Rules

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

// Compute a heuristic confidence score (0-95) based on how many fields were
// successfully extracted. Replaces the old hardcoded 85% for flows that don't
// have real word-level OCR confidence from Cloud Vision.
function computeHeuristicConfidence(entry: {
    name?: string;
    company?: string;
    position?: string;
    phone?: string[] | string;
    email?: string[] | string;
    address?: string;
    notes?: string;
}): number {
    let score = 55;
    const has = (v: unknown): boolean => {
        if (Array.isArray(v)) return v.length > 0 && v.some(x => typeof x === 'string' && x.trim().length > 0);
        return typeof v === 'string' && v.trim().length > 0;
    };
    if (has(entry.name)) score += 12;
    if (has(entry.company)) score += 10;
    if (has(entry.phone)) score += 8;
    if (has(entry.email)) score += 8;
    if (has(entry.position)) score += 4;
    if (has(entry.address)) score += 3;
    if (has(entry.notes)) score += 2;
    return Math.max(0, Math.min(95, score));
}

// Shared fetch + retry wrapper for all Gemini calls. Retries on transient
// failures (429/500/502/503/504, "high demand" / "overloaded" messages,
// network errors) with exponential backoff (1s, 2s, 4s — 3 attempts total).
// Flows that don't use this helper (anything directly calling /api/gemini)
// will fall back to the rule-based parser on the first failure.
async function callGeminiWithRetry(opts: {
    body: string;
    flowName: string;
    timeoutMs?: number;
}): Promise<any> {
    const timeoutMs = opts.timeoutMs ?? 90000;
    const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
    const RETRY_MESSAGE_RE = /high demand|overloaded|temporarily unavailable|try again later/i;
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [1000, 2000, 4000];

    const headers = await authHeaders();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers,
                body: opts.body,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const baseMsg = errorData.details?.error?.message || errorData.error || `Gemini API error: ${response.status}`;
                const fullMsg = errorData.reason ? `${baseMsg} [${errorData.reason}]` : baseMsg;
                const retryable = RETRY_STATUSES.has(response.status) || RETRY_MESSAGE_RE.test(fullMsg);
                if (retryable && attempt < MAX_ATTEMPTS - 1) {
                    console.log(`[${opts.flowName}] Transient error ${response.status}, retrying in ${BACKOFF_MS[attempt]}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
                    await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
                    lastError = new Error(fullMsg);
                    continue;
                }
                throw new Error(fullMsg);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No response from Gemini');
            return text;
        } catch (error: any) {
            clearTimeout(timeout);
            const msg = error?.message || String(error);
            const isNetworkError = error?.name === 'AbortError' || /failed to fetch|network|timeout/i.test(msg);
            const isMessageRetryable = RETRY_MESSAGE_RE.test(msg);
            if ((isNetworkError || isMessageRetryable) && attempt < MAX_ATTEMPTS - 1) {
                console.log(`[${opts.flowName}] Transient error "${msg}", retrying in ${BACKOFF_MS[attempt]}ms (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
                await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
                lastError = error;
                continue;
            }
            throw error;
        }
    }
    throw lastError || new Error('Gemini call failed after retries');
}

export interface OCRResult {
    name: string;
    position: string;
    company: string;
    phone: string[];
    email: string[];
    address: string;
    notes: string;
    rawText: string;
    confidence: number;
}

export type OCREngine = 'tesseract' | 'cloud-vision';

export const getOCREngine = (): OCREngine => {
    return 'cloud-vision';
};

export const setOCREngine = (engine: OCREngine): void => {
    localStorage.setItem('ocr_engine', engine);
};

// Common job titles for position detection
const JOB_TITLES = [
    // C-Level
    'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'chief',
    // Directors & VPs
    'director', 'vp', 'vice president', 'head of', 'president',
    // Managers
    'manager', 'supervisor', 'lead', 'team lead', 'coordinator', 'leader', 'team leader', 'project leader',
    // Technical
    'engineer', 'developer', 'architect', 'analyst', 'consultant',
    'programmer', 'designer', 'specialist', 'technician',
    // Business
    'executive', 'officer', 'associate', 'representative', 'agent',
    'advisor', 'partner', 'founder', 'owner', 'proprietor',
    // Sales & Marketing
    'sales', 'marketing', 'account', 'business development',
    // Admin & Support
    'assistant', 'secretary', 'administrator', 'receptionist',
    // Academic & Medical
    'professor', 'doctor', 'dr.', 'attorney', 'lawyer', 'nurse',
    // Senior/Junior prefixes
    'senior', 'junior', 'sr.', 'jr.', 'intern'
];

// Company suffixes for detection
const COMPANY_SUFFIXES = [
    'inc', 'inc.', 'incorporated',
    'ltd', 'ltd.', 'limited',
    'llc', 'l.l.c.',
    'corp', 'corp.', 'corporation',
    'co', 'co.', 'company',
    'group', 'holdings', 'enterprises',
    'solutions', 'services', 'technologies', 'tech',
    'systems', 'partners', 'associates',
    'international', 'global', 'worldwide',
    'foundation', 'institute', 'university', 'college',
    'hospital', 'medical', 'health', 'healthcare',
    'pharma', 'pharmaceutical', 'manufacturers', 'manufacturing',
    'association', 'society', 'organization', 'federation', 'council',
    'products', 'product', 'packaging', 'supply', 'supplies',
    'provider', 'providers', 'industries', 'industrial',
    'trading', 'construction', 'development', 'developers',
    'agency', 'studio', 'laboratories', 'labs',
    'bank', 'financial', 'insurance', 'realty', 'properties'
];

// Address keywords
const ADDRESS_KEYWORDS = [
    'street', 'st.', 'st,',
    'road', 'rd.', 'rd,',
    'avenue', 'ave.', 'ave,',
    'boulevard', 'blvd.', 'blvd,',
    'drive', 'dr.', 'dr,',
    'lane', 'ln.', 'ln,',
    'floor', 'flr.', 'flr',
    'suite', 'ste.', 'ste',
    'unit', 'building', 'bldg',
    'tower', 'plaza', 'center', 'centre',
    'city', 'town', 'village',
    'barangay', 'brgy',
    'province', 'district',
    'zip', 'postal'
];

/**
 * Smart title-case: handles ALL CAPS, all lower, and preserves
 * mixed-case words like "McDonald", "O'Brien", "de la Cruz".
 * Also preserves known prefixes (Dr., Engr.) and suffixes (MD, PhD, CPA, etc.).
 */
function smartCapitalize(name: string): string {
    if (!name) return name;

    const suffixes = new Set([
        'MD', 'PhD', 'CPA', 'REE', 'PEE', 'PE', 'MBA', 'MSEE', 'RN', 'DDS',
        'JD', 'LLB', 'LLM', 'BSN', 'MSN', 'DO', 'DVM', 'PharmD',
        'II', 'III', 'IV', 'Jr', 'Sr',
    ]);

    const lowercaseWords = new Set(['de', 'del', 'dela', 'la', 'los', 'las', 'van', 'von', 'der', 'den', 'di', 'da', 'el', 'al', 'bin', 'binti']);

    const words = name.split(/\s+/);
    const result = words.map((word, idx) => {
        // Strip trailing comma/period for comparison, re-add after
        const trailingPunct = word.match(/[,.]$/)?.[0] || '';
        const bare = trailingPunct ? word.slice(0, -1) : word;

        // Preserve known suffixes (always uppercase)
        if (suffixes.has(bare.toUpperCase())) {
            return bare.toUpperCase() + trailingPunct;
        }

        // Preserve prefixes like "Dr.", "Engr.", "Atty.", "Arch.", "Jr.", "Sr.", "Esq."
        const prefixMatch = bare.match(/^([A-Za-z]{2,5})\.$/);
        if (prefixMatch) {
            const p = prefixMatch[1];
            return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() + '.' + trailingPunct;
        }

        // Lowercase particles (de, del, van, etc.) — but not at start of name
        if (idx > 0 && lowercaseWords.has(bare.toLowerCase())) {
            return bare.toLowerCase() + trailingPunct;
        }

        // If already mixed case (e.g., "McDonald", "O'Brien") and not ALL CAPS, preserve
        const isAllCaps = bare === bare.toUpperCase() && bare.length > 1;
        const isAllLower = bare === bare.toLowerCase();
        if (!isAllCaps && !isAllLower) {
            return word; // preserve original casing
        }

        // Handle hyphenated names (e.g., "O'BRIEN-CRUZ" → "O'Brien-Cruz")
        if (bare.includes('-')) {
            return bare.split('-').map(part =>
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            ).join('-') + trailingPunct;
        }

        // Handle apostrophe names (e.g., "O'BRIEN" → "O'Brien")
        if (bare.includes("'")) {
            return bare.split("'").map(part =>
                part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            ).join("'") + trailingPunct;
        }

        // Standard title case
        return bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase() + trailingPunct;
    });

    return result.join(' ');
}

export class OCRService {
    private worker: any = null;
    private isInitializing: boolean = false;
    private currentEngine: OCREngine = getOCREngine();

    // API calls are routed through backend serverless functions to keep keys secure

    /**
     * Single card processing via direct Gemini (no Cloud Vision pre-step).
     * Uses the same pipeline as Multi-Card scan because that path has been
     * empirically shown to produce more accurate results: when Gemini is
     * given both OCR-extracted text and the image, it over-anchors on the
     * text and ignores contradictory visual cues (e.g. stacked logo company
     * names), even with explicit instructions to prefer the image. Dropping
     * the Cloud Vision pre-step eliminates that failure mode.
     */
    async processSingleCardDirect(imageSrc: string): Promise<OCRResult> {
        console.log('[Single Card] Parsing directly with Gemini (no Cloud Vision)...');

        const entries = await this.parseMultiCards(imageSrc);

        if (entries.length === 0) {
            throw new Error('No card detected in image');
        }

        // For single card scans we take the first (and usually only) entry.
        // If the user accidentally photographed multiple cards here, they
        // still get one — they can re-scan through Multi-Card if needed.
        const first = entries[0];
        return {
            name: first.name,
            position: first.position,
            company: first.company,
            phone: first.phone,
            email: first.email,
            address: first.address,
            notes: first.notes,
            rawText: '',
            confidence: first.confidence,
        };
    }

    /**
     * Legacy path: Cloud Vision OCR → Gemini parse → rule-based fallback.
     * No longer called by processImage() because the text-anchoring issue
     * it introduced degraded single-card accuracy. Kept for reference and
     * in case we need to restore it for debugging.
     */
    async processImageWithCloudVision(imageSrc: string): Promise<OCRResult> {
        console.log('[Cloud Vision] Starting image analysis...');

        try {
            const response = await fetch('/api/ocr', {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ imageData: imageSrc })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const baseMsg = errorData.details?.error?.message || errorData.error || `Cloud Vision API error: ${response.status}`;
                const fullMsg = errorData.reason ? `${baseMsg} [${errorData.reason}]` : baseMsg;
                throw new Error(fullMsg);
            }

            const data = await response.json();
            console.log('[Cloud Vision] Response received:', data);

            const visionResponse = data?.responses?.[0];

            // Use fullTextAnnotation for better structured text (from DOCUMENT_TEXT_DETECTION)
            const fullTextAnnotation = visionResponse?.fullTextAnnotation;
            const annotations = visionResponse?.textAnnotations;

            if (!fullTextAnnotation && (!annotations || annotations.length === 0)) {
                throw new Error('No text detected in image');
            }

            const fullText = fullTextAnnotation?.text || annotations?.[0]?.description || '';
            console.log('[Cloud Vision] Full text extracted:', fullText);

            if (!fullText.trim()) {
                throw new Error('Empty text from Cloud Vision');
            }

            // Extract real confidence from Cloud Vision word-level data
            let realConfidence = 90;
            try {
                const pages = fullTextAnnotation?.pages;
                if (pages && pages.length > 0) {
                    const wordConfidences: number[] = [];
                    for (const page of pages) {
                        for (const block of page.blocks || []) {
                            for (const paragraph of block.paragraphs || []) {
                                for (const word of paragraph.words || []) {
                                    if (word.confidence !== undefined) {
                                        wordConfidences.push(word.confidence);
                                    }
                                }
                            }
                        }
                    }
                    if (wordConfidences.length > 0) {
                        realConfidence = Math.round(
                            (wordConfidences.reduce((a: number, b: number) => a + b, 0) / wordConfidences.length) * 100
                        );
                    }
                }
            } catch (e) {
                console.log('[Cloud Vision] Could not extract confidence scores, using default');
            }
            console.log('[Cloud Vision] Confidence:', realConfidence + '%');

            // Try AI parsing first (Gemini), fallback to rule-based parser
            let parsedData;
            try {
                parsedData = await this.parseWithGemini(fullText, imageSrc);
                console.log('[Cloud Vision] Gemini AI parsing succeeded:', parsedData);
            } catch (geminiError) {
                console.log('[Cloud Vision] Gemini parsing failed, using rule-based parser:', geminiError);
                parsedData = this.parseText(fullText);
            }

            return {
                ...parsedData,
                rawText: fullText,
                confidence: realConfidence
            };

        } catch (error) {
            console.error('[Cloud Vision] Error:', error);
            throw error;
        }
    }

    /**
     * Use Gemini AI to intelligently parse raw OCR text into structured contact data.
     * Sends both the OCR text AND the original image for multimodal analysis.
     * Much more accurate than rule-based parsing for complex cards.
     */
    async parseWithGemini(rawText: string, base64Image?: string): Promise<Omit<OCRResult, 'rawText' | 'confidence'>> {
        console.log('[Gemini] Parsing single card with AI...');

        const prompt = `You are an expert business card data extractor. You are given the raw OCR text from a business card AND the original card image. Use the image as the source of truth when the OCR text is fragmented, ambiguous, or visually stacked across multiple lines. Extract structured contact information from both signals.

${GEMINI_CORE_RULES}

## Examples

### Example 1: Stacked logo company name with multiple addresses and multiple phones

Input OCR text:
EARL BRYAN DY
VP SALES & MARKETING
KINMO PW
CORPORATION
"Satisfying the needs of today and tomorrow"
+63968.7269310 8703-5284 / 8362-5820
+63917.8878017 8251-0507 / 8251-0508
+63977.8407799
earldy.kinmo@gmail.com
www.kinmo.com
www.facebook.com/kinmopwcorporation
Main Office:
1732 Jose Abad Santos
St. Manila, Philippines
ShowRoom:
121 Scout Dr. Lazcano Street,
Brgy. Sacred Heart Quezon City
BGC Office:
Unit 3C-1 Seibu Tower, 6th Ave.,
24th St., BGC Taguig City

Output:
{"name": "Earl Bryan Dy", "position": "VP Sales & Marketing", "company": "KINMO PW Corporation", "phone": ["+63968.7269310", "+63917.8878017", "+63977.8407799", "8703-5284", "8362-5820", "8251-0507", "8251-0508"], "email": ["earldy.kinmo@gmail.com"], "address": "Main Office: 1732 Jose Abad Santos St., Manila, Philippines | ShowRoom: 121 Scout Dr. Lazcano Street, Brgy. Sacred Heart, Quezon City | BGC Office: Unit 3C-1 Seibu Tower, 6th Ave., 24th St., BGC, Taguig City", "notes": "www.kinmo.com | www.facebook.com/kinmopwcorporation | Satisfying the needs of today and tomorrow"}

### Example 2: Brand mark above legal name, single address, fax line

Input OCR text:
CLEARPACK
THE CLEAR CHOICE FOR PACKAGING
John Michael Santos
Regional Sales Director
Clearpack Technology (Phils.) Inc.
Unit 5B Pacific Star Bldg., Makati Ave.
Makati City 1226, Philippines
M: +63 917 123 4567
T: +63 2 8888 1234
F: +63 2 8888 1235
john.santos@ph.clearpack.com
www.clearpack.com

Output:
{"name": "John Michael Santos", "position": "Regional Sales Director", "company": "Clearpack Technology (Phils.) Inc.", "phone": ["+63 917 123 4567", "+63 2 8888 1234", "+63 2 8888 1235 (Fax)"], "email": ["john.santos@ph.clearpack.com"], "address": "Unit 5B Pacific Star Bldg., Makati Ave., Makati City 1226, Philippines", "notes": "www.clearpack.com | The clear choice for packaging"}

### Example 3: Credentials on separate line, single address

Input OCR text:
Engr. Roberto M. Dela Cruz
REE, PEE, MSEE
Vice President - Technical Operations
PhilEnergy Power Solutions Corp.
Unit 12F Rockwell Business Center
Makati City 1210, Philippines
+63 917 888 9999
+63 2 8812 3456
+63 2 8812 3457 (Fax)
roberto.delacruz@philenergy.com.ph

Output:
{"name": "Engr. Roberto M. Dela Cruz, REE, PEE, MSEE", "position": "Vice President - Technical Operations", "company": "PhilEnergy Power Solutions Corp.", "phone": ["+63 917 888 9999", "+63 2 8812 3456", "+63 2 8812 3457 (Fax)"], "email": ["roberto.delacruz@philenergy.com.ph"], "address": "Unit 12F Rockwell Business Center, Makati City 1210, Philippines", "notes": ""}

### Example 4: Multiple emails

Input OCR text:
Dr. Wei Lin Chen
Associate Professor
Department of Computer Science
National University of Singapore
13 Computing Drive, Singapore 117417
+65 6516 1234
weichen@comp.nus.edu.sg
wlchen.research@nus.edu.sg

Output:
{"name": "Dr. Wei Lin Chen", "position": "Associate Professor, Department of Computer Science", "company": "National University of Singapore", "phone": ["+65 6516 1234"], "email": ["weichen@comp.nus.edu.sg", "wlchen.research@nus.edu.sg"], "address": "13 Computing Drive, Singapore 117417", "notes": ""}

## Business Card Text to Parse

<card_text>
${rawText}
</card_text>

Return ONLY the JSON object. No explanation, no markdown. Use the original card image to verify visually-stacked elements (especially company names) and to recover any text the OCR may have fragmented or missed.`;

        const parts: any[] = [{ text: prompt }];
        if (base64Image) {
            const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
            parts.push({ inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } });
        }

        const requestBody = JSON.stringify({
            contents: [{ parts }],
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.0,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING' },
                        position: { type: 'STRING' },
                        company: { type: 'STRING' },
                        phone: { type: 'ARRAY', items: { type: 'STRING' } },
                        email: { type: 'ARRAY', items: { type: 'STRING' } },
                        address: { type: 'STRING' },
                        notes: { type: 'STRING' }
                    },
                    required: ['name', 'position', 'company', 'phone', 'email', 'address', 'notes']
                }
            }
        });

        const text = await callGeminiWithRetry({ body: requestBody, flowName: 'Gemini', timeoutMs: 60000 });
        console.log('[Gemini] Raw response:', text);

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in Gemini response');
            parsed = JSON.parse(jsonMatch[0]);
        }

        return {
            name: smartCapitalize(parsed.name || ''),
            position: parsed.position || '',
            company: parsed.company || '',
            phone: Array.isArray(parsed.phone) ? parsed.phone : parsed.phone ? [parsed.phone] : [],
            email: Array.isArray(parsed.email) ? parsed.email : parsed.email ? [parsed.email] : [],
            address: parsed.address || '',
            notes: parsed.notes || ''
        };
    }

    private async getWorker(): Promise<any> {
        // Prevent multiple simultaneous initializations
        if (this.isInitializing) {
            // Wait for existing initialization to complete
            while (this.isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.worker;
        }

        if (!this.worker) {
            this.isInitializing = true;
            try {
                console.log('[OCR] Initializing Tesseract worker...');
                // Tesseract.js v5 API - createWorker returns a promise that resolves to a worker
                this.worker = await createWorker('eng', 1, {
                    logger: (m: any) => {
                        console.log('[Tesseract]', m.status, Math.round((m.progress || 0) * 100) + '%');
                    }
                });
                console.log('[OCR] Tesseract worker initialized successfully');
            } catch (error) {
                console.error('[OCR] Failed to initialize Tesseract worker:', error);
                this.isInitializing = false;
                throw error;
            }
            this.isInitializing = false;
        }
        return this.worker;
    }

    async processImage(imageSrc: string, engine?: OCREngine): Promise<OCRResult> {
        const selectedEngine = engine || getOCREngine();
        console.log(`[OCR] Starting image processing with engine: ${selectedEngine}`);

        // Route to appropriate engine.
        // 'cloud-vision' label is kept for compatibility with stored prefs,
        // but the actual path is now direct-Gemini (no Cloud Vision pre-OCR).
        if (selectedEngine === 'cloud-vision') {
            return this.processSingleCardDirect(imageSrc);
        }

        // Default: Tesseract OCR
        try {
            // Preprocess image for better OCR
            console.log('[OCR] Preprocessing image...');
            const processedImage = await this.preprocessImage(imageSrc);
            console.log('[OCR] Image preprocessed successfully');

            console.log('[OCR] Getting worker...');
            const worker = await this.getWorker();
            console.log('[OCR] Worker ready, recognizing text...');

            const result = await worker.recognize(processedImage);
            console.log('[OCR] Recognition complete:', result);

            const { data: { text, confidence } } = result;
            console.log('[OCR] Raw text extracted:', text.substring(0, 100) + '...');
            console.log('[OCR] Confidence:', confidence);

            const parsedData = this.parseText(text);
            console.log('[OCR] Parsed data:', parsedData);

            return {
                ...parsedData,
                rawText: text,
                confidence
            };
        } catch (error) {
            console.error('[OCR] Error during processing:', error);
            throw error;
        }
    }

    /**
     * Preprocess image for better OCR accuracy
     * - Convert to grayscale
     * - Enhance contrast
     * - Resize to optimal dimensions
     */
    private async preprocessImage(imageSrc: string): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    resolve(imageSrc);
                    return;
                }

                // Calculate optimal size (target ~300 DPI equivalent)
                const maxDimension = 2000;
                let { width, height } = img;

                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                // Draw original image
                ctx.drawImage(img, 0, 0, width, height);

                // Get image data for processing
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // Convert to grayscale and enhance contrast
                for (let i = 0; i < data.length; i += 4) {
                    // Grayscale using luminosity method
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

                    // Contrast enhancement (increase contrast by 1.2x)
                    const contrast = 1.2;
                    const factor = (259 * (contrast * 128 + 255)) / (255 * (259 - contrast * 128));
                    const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

                    data[i] = enhanced;     // R
                    data[i + 1] = enhanced; // G
                    data[i + 2] = enhanced; // B
                    // Alpha stays the same
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };

            img.onerror = () => resolve(imageSrc);
            img.src = imageSrc;
        });
    }

    parseText(text: string): Omit<OCRResult, 'rawText' | 'confidence'> {
        const result = {
            name: '',
            position: '',
            company: '',
            phone: [] as string[],
            email: [] as string[],
            address: '',
            notes: ''
        };

        // Normalize text
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = normalizedText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Create a working copy to track what's been assigned
        const usedLines = new Set<number>();

        // Step 1: Extract emails (high confidence - regex)
        result.email = this.extractEmails(normalizedText);

        // Step 2: Extract phone numbers (high confidence - regex)
        result.phone = this.extractPhones(normalizedText);

        // Mark lines containing phones/emails/URLs as used
        for (let i = 0; i < lines.length; i++) {
            if (this.isPhoneLine(lines[i], result.phone) || this.isEmailLine(lines[i], result.email) || this.isURL(lines[i])) {
                usedLines.add(i);
            }
        }

        // Step 3: Extract address (collect multi-line addresses, avoiding phone/email lines)
        const addressResult = this.extractAddress(lines, usedLines, result.phone, result.email);
        result.address = addressResult.address;
        addressResult.usedIndices.forEach(i => usedLines.add(i));

        // Step 4: Detect company name
        const companyResult = this.extractCompany(lines, usedLines, result.email);
        result.company = companyResult.company;
        if (companyResult.lineIndex >= 0) usedLines.add(companyResult.lineIndex);

        // Step 5: Detect position/job title
        const positionResult = this.extractPosition(lines, usedLines);
        result.position = positionResult.position;
        if (positionResult.lineIndex >= 0) usedLines.add(positionResult.lineIndex);

        // Step 6: Extract name (remaining prominent text, usually near the top)
        result.name = smartCapitalize(this.extractName(lines, usedLines, result));

        return result;
    }

    private extractEmails(text: string): string[] {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        const matches = text.match(emailRegex) || [];
        // Remove duplicates and clean up
        return [...new Set(matches.map(e => e.toLowerCase()))];
    }

    private extractPhones(text: string): string[] {
        // Comprehensive phone regex patterns
        const phonePatterns = [
            // International format: +1 (555) 123-4567, +63 917 123 4567
            /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,
            // US/Standard: (555) 123-4567, 555-123-4567
            /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
            // Philippine mobile: 09171234567, 0917 123 4567
            /0\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/g,
            // Philippine landline: (02) 8888-8888, 02-8888-8888
            /\(0\d{1,2}\)[\s.-]?\d{4}[\s.-]?\d{4}/g,
            // Short format: 8888-8888
            /\d{4}[\s.-]\d{4}/g,
            // With extension: ext, x, extension
            /\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?:\s*(?:ext|x|extension)\.?\s*\d{1,5})?/gi
        ];

        const allMatches: string[] = [];

        for (const pattern of phonePatterns) {
            const matches = text.match(pattern) || [];
            allMatches.push(...matches);
        }

        // Clean and deduplicate
        const cleaned = allMatches
            .map(p => p.replace(/\s+/g, ' ').trim())
            .filter(p => {
                // Must have at least 7 digits
                const digitCount = (p.match(/\d/g) || []).length;
                return digitCount >= 7 && digitCount <= 15;
            });

        // Remove duplicates: exact digit match AND substring matches (keep longest)
        const withDigits = cleaned.map(phone => ({
            phone,
            digits: phone.replace(/\D/g, '')
        }));

        // Sort by digit length descending so longer numbers come first
        withDigits.sort((a, b) => b.digits.length - a.digits.length);

        const kept: typeof withDigits = [];
        for (const item of withDigits) {
            // Skip if these digits are already contained in a longer number we kept
            const isSubset = kept.some(k => k.digits.includes(item.digits));
            // Skip exact duplicates
            const isExact = kept.some(k => k.digits === item.digits);
            if (!isSubset && !isExact) {
                kept.push(item);
            }
        }

        return kept.map(k => k.phone);
    }

    private isPhoneLine(line: string, phones: string[]): boolean {
        const lineDigits = line.replace(/\D/g, '');
        // Check if this line contains any of the extracted phone numbers
        for (const phone of phones) {
            const phoneDigits = phone.replace(/\D/g, '');
            if (phoneDigits.length >= 7 && lineDigits.includes(phoneDigits)) {
                return true;
            }
        }
        // Also check if line is mostly digits (likely a phone)
        const digitCount = (line.match(/\d/g) || []).length;
        const totalChars = line.replace(/\s/g, '').length;
        return totalChars > 0 && (digitCount / totalChars) > 0.6;
    }

    private isEmailLine(line: string, emails: string[]): boolean {
        return emails.some(email => line.toLowerCase().includes(email.toLowerCase()));
    }

    private extractAddress(lines: string[], usedLines: Set<number>, phones: string[], emails: string[]): { address: string; usedIndices: number[] } {
        const usedIndices: number[] = [];
        const addressLines: string[] = [];

        // Find lines that look like address components
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;

            const line = lines[i];
            const lineLower = line.toLowerCase();

            // Skip lines that are primarily phone numbers or contain emails
            if (this.isPhoneLine(line, phones)) continue;
            if (this.isEmailLine(line, emails)) continue;

            // Must have address keywords to be considered an address line
            const hasAddressKeyword = ADDRESS_KEYWORDS.some(kw => lineLower.includes(kw));
            const hasStreetNumber = /^\d+\s+[a-zA-Z]/.test(line);
            const hasPostalCode = /\b\d{4,5}\b/.test(line) && hasAddressKeyword;

            if (hasAddressKeyword || hasStreetNumber || hasPostalCode) {
                // Clean the line - remove any embedded phone numbers
                let cleanedLine = line;
                for (const phone of phones) {
                    cleanedLine = cleanedLine.replace(phone, '').trim();
                }
                // Remove leftover separators
                cleanedLine = cleanedLine.replace(/^[\s,\/\-]+|[\s,\/\-]+$/g, '').trim();

                if (cleanedLine.length > 3) {
                    addressLines.push(cleanedLine);
                    usedIndices.push(i);
                }
            }
        }

        return {
            address: addressLines.join(', '),
            usedIndices
        };
    }

    private extractCompany(lines: string[], usedLines: Set<number>, emails: string[]): { company: string; lineIndex: number } {
        // Try to extract company from email domain
        const emailDomainCompany = this.getCompanyFromEmail(emails);

        // Score each line for company likelihood
        let bestIndex = -1;
        let bestScore = 0;

        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;

            const line = lines[i];
            const lineLower = line.toLowerCase();
            let score = 0;

            // Skip URLs - they're not company names
            if (this.isURL(line)) continue;

            // Check for company suffixes
            for (const suffix of COMPANY_SUFFIXES) {
                const regex = new RegExp(`\\b${suffix}\\b`, 'i');
                if (regex.test(lineLower)) {
                    score += 3;
                    break;
                }
            }

            // ALL CAPS lines that are text-only (no numbers) are likely company/brand names
            if (line === line.toUpperCase() && line.length > 3 && /^[A-Z\s&.,\-']+$/.test(line)) {
                score += 2;
            }

            // Lines with ® or ™ are likely company names
            if (/[®™©]/.test(line)) {
                score += 3;
            }

            // Skip if it looks like a person's name
            if (this.looksLikeName(line)) {
                score -= 2;
            }

            // Always penalize taglines/slogans heavily - even if they contain company-like words
            if (this.looksLikeTagline(line)) {
                score -= 5;
            }

            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }

        if (bestIndex >= 0) {
            // Forward+backward merge: combine adjacent lines that are part of the company name
            let startIndex = bestIndex;
            let endIndex = bestIndex;

            // Merge backward
            for (let i = bestIndex - 1; i >= 0; i--) {
                if (usedLines.has(i)) break;
                if (this.isCompanyPart(lines[i]) && !this.looksLikeName(lines[i])) {
                    startIndex = i;
                } else {
                    break;
                }
            }

            // Merge forward
            for (let i = bestIndex + 1; i < lines.length; i++) {
                if (usedLines.has(i)) break;
                if (this.isCompanyPart(lines[i]) && !this.looksLikeName(lines[i])) {
                    endIndex = i;
                } else {
                    break;
                }
            }

            // Build the full company name
            const companyParts: string[] = [];
            for (let i = startIndex; i <= endIndex; i++) {
                companyParts.push(lines[i]);
                usedLines.add(i);
            }

            return { company: companyParts.join(' '), lineIndex: startIndex };
        }

        // If we found a company from email, use that
        if (emailDomainCompany) {
            return { company: emailDomainCompany, lineIndex: -1 };
        }

        // Fallback: first unused line that's not a name pattern
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];
            if (this.looksLikeName(line)) continue;
            if (/@/.test(line) || /\d{3,}/.test(line)) continue;
            return { company: line, lineIndex: i };
        }

        return { company: '', lineIndex: -1 };
    }

    private looksLikeTagline(text: string): boolean {
        const lower = text.trim().toLowerCase();

        // Common tagline/slogan patterns
        const taglinePatterns = [
            /^your\s+/i,              // "Your Trusted Partner"
            /^we\s+/i,               // "We Build Solutions"
            /^where\s+/i,            // "Where Quality Meets..."
            /^the\s+best\b/i,        // "The Best in..."
            /^leading\s+/i,          // "Leading the way..."
            /^committed\s+to\b/i,    // "Committed to excellence"
            /^excellence\s+in\b/i,   // "Excellence in..."
            /^delivering\b/i,        // "Delivering quality..."
            /^building\s+/i,         // "Building the future"
            /^creating\s+/i,         // "Creating value"
            /^making\s+/i,           // "Making a difference"
            /^powering\s+/i,         // "Powering innovation"
            /^trusted\b/i,           // "Trusted by..."
            /^innovative\b/i,        // "Innovative solutions"
            /^quality\b/i,           // "Quality first"
            /choice\s+for\b/i,       // "Choice for packaging"
            /clear\s+choice/i,       // "Clear choice for..."
            /^best\s+/i,             // "Best in class"
            /^premier\b/i,           // "Premier provider"
            /^total\s+/i,            // "Total solutions"
            /^complete\s+/i,         // "Complete package"
        ];

        for (const pattern of taglinePatterns) {
            if (pattern.test(lower)) return true;
        }

        // Tagline keywords that are very common in slogans
        const taglineWords = ['trusted', 'partner', 'excellence', 'innovation', 'passion',
            'commitment', 'integrity', 'driven', 'beyond', 'together', 'future',
            'smarter', 'better', 'faster', 'world-class', 'premier'];
        const wordCount = taglineWords.filter(w => lower.includes(w)).length;
        if (wordCount >= 2) return true;

        return false;
    }

    private isURL(line: string): boolean {
        return /(?:www\.|https?:\/\/|\.com|\.org|\.net|\.ph|\.sg|\.co\.\w+)/i.test(line.trim());
    }

    private isCompanyPart(line: string): boolean {
        const lower = line.toLowerCase();

        // Never merge URLs into company names
        if (this.isURL(line)) return false;

        // Has a company suffix (use word boundary regex, not substring includes)
        for (const suffix of COMPANY_SUFFIXES) {
            const regex = new RegExp(`\\b${suffix}\\b`, 'i');
            if (regex.test(lower)) return true;
        }

        // ALL CAPS text-only line (brand/company name)
        if (line === line.toUpperCase() && line.length > 2 && /^[A-Z\s&.,\-']+$/.test(line)) {
            return true;
        }

        // Parenthetical continuation like "(Phil. Rep. Office)"
        if (/^\(/.test(line.trim())) return true;

        return false;
    }

    private getCompanyFromEmail(emails: string[]): string | null {
        if (emails.length === 0) return null;

        const email = emails[0];
        const domain = email.split('@')[1];
        if (!domain) return null;

        const parts = domain.split('.');
        const genericDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'mail', 'aol'];

        // For subdomains like ph.clearpack.com, skip country code prefixes
        // and use the main domain name
        const countryCodes = ['ph', 'sg', 'my', 'id', 'th', 'vn', 'jp', 'kr', 'cn', 'tw',
            'in', 'au', 'us', 'uk', 'de', 'fr', 'hk', 'nz', 'br', 'mx', 'ca'];

        let domainName = parts[0].toLowerCase();

        // If first part is a country code and there are more parts, use the next part
        if (countryCodes.includes(domainName) && parts.length >= 3) {
            domainName = parts[1].toLowerCase();
        }

        if (genericDomains.includes(domainName)) return null;

        // Capitalize domain name
        return domainName.charAt(0).toUpperCase() + domainName.slice(1);
    }

    private extractPosition(lines: string[], usedLines: Set<number>): { position: string; lineIndex: number } {
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;

            const line = lines[i];
            const lineLower = line.toLowerCase();

            // Check if line contains job title keywords
            const hasJobTitle = JOB_TITLES.some(title => {
                const regex = new RegExp(`\\b${title}\\b`, 'i');
                return regex.test(lineLower);
            });

            if (hasJobTitle) {
                return { position: line, lineIndex: i };
            }
        }

        return { position: '', lineIndex: -1 };
    }

    private extractName(lines: string[], usedLines: Set<number>, result: Omit<OCRResult, 'rawText' | 'confidence'>): string {
        // Helper to check if a line should be skipped
        const shouldSkipLine = (line: string): boolean => {
            if (result.email.some(e => line.toLowerCase().includes(e))) return true;
            if (/@/.test(line)) return true;
            if (this.isPhoneLine(line, result.phone)) return true;
            if (line.length < 3) return true;
            if (/[®™©]/.test(line)) return true;
            const specialChars = (line.match(/[|@#$%^&*()_+=\[\]{}\\/<>]/g) || []).length;
            if (specialChars > 1) return true;
            return false;
        };

        // First pass: look for MULTI-WORD names (2+ words) - highest confidence
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];
            if (shouldSkipLine(line)) continue;

            const words = line.trim().split(/\s+/);
            if (words.length >= 2 && this.looksLikeName(line)) {
                return line;
            }
        }

        // Second pass: single-word names (less confident, might be brand names)
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];
            if (shouldSkipLine(line)) continue;

            const words = line.trim().split(/\s+/);
            if (words.length === 1 && this.looksLikeName(line)) {
                // Extra caution: reject single ALL CAPS words (likely brand names)
                if (/^[A-Z]+$/.test(line.trim())) continue;
                return line;
            }
        }

        // Third pass: look for any reasonable text line near the top
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];
            if (shouldSkipLine(line)) continue;

            if (/@/.test(line)) continue;
            if (/\d{4,}/.test(line)) continue;

            // Accept if it's mostly letters and not a known non-name
            const letterRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
            if (letterRatio > 0.7 && !this.looksLikeTagline(line)) {
                return line;
            }
        }

        return '';
    }

    private looksLikeName(text: string): boolean {
        // Trim and check basic structure
        const trimmed = text.trim();

        // Reject lines with brand/trademark symbols (®™©)
        if (/[®™©]/.test(trimmed)) return false;

        // Names are typically 2-4 words
        const words = trimmed.split(/\s+/);
        if (words.length < 1 || words.length > 5) return false;

        // Should be mostly letters
        const letterRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
        if (letterRatio < 0.8) return false;

        // Reject known country names
        const countries = [
            'philippines', 'singapore', 'malaysia', 'indonesia', 'thailand',
            'vietnam', 'japan', 'korea', 'china', 'taiwan', 'india',
            'australia', 'usa', 'united states', 'canada', 'uk',
            'united kingdom', 'germany', 'france', 'italy', 'spain',
            'hong kong', 'macau', 'brunei', 'myanmar', 'cambodia', 'laos',
            'saudi arabia', 'united arab emirates', 'qatar', 'bahrain',
            'kuwait', 'oman', 'egypt', 'south africa', 'brazil', 'mexico',
            'new zealand', 'south korea', 'north korea', 'sri lanka'
        ];
        const lower = trimmed.toLowerCase();
        if (countries.includes(lower)) return false;

        // Reject lines containing common company/organization words
        // This must stay in sync with COMPANY_SUFFIXES
        const companyWords = [
            'inc', 'corp', 'llc', 'ltd', 'company', 'incorporated', 'limited', 'corporation',
            'enterprises', 'group', 'holdings', 'partners', 'associates',
            'services', 'solutions', 'systems', 'technologies', 'tech', 'industries', 'industrial',
            'international', 'global', 'worldwide',
            'foundation', 'institute', 'university', 'college', 'association', 'society',
            'organization', 'federation', 'council',
            'hospital', 'medical', 'health', 'healthcare',
            'pharma', 'pharmaceutical', 'manufacturers', 'manufacturing',
            'products', 'packaging', 'supply', 'supplies', 'provider', 'providers',
            'trading', 'construction', 'development', 'developers',
            'agency', 'studio', 'laboratories', 'labs',
            'bank', 'financial', 'insurance', 'realty', 'properties',
            'pte'
        ];
        for (const w of companyWords) {
            const regex = new RegExp(`\\b${w}\\b`, 'i');
            if (regex.test(lower)) return false;
        }

        // Reject lines starting with articles/determiners (not real names)
        const articles = ['the', 'a', 'an', 'your', 'our', 'their', 'this', 'that', 'for', 'of'];
        const firstWord = words[0].toLowerCase();
        if (articles.includes(firstWord)) return false;

        // Reject common non-name words that appear as ALL CAPS headings
        const nonNameWords = ['clear', 'choice', 'best', 'quality', 'premium', 'trusted',
            'leading', 'innovative', 'smart', 'total', 'complete', 'perfect', 'first'];
        if (words.some(w => nonNameWords.includes(w.toLowerCase()))) return false;

        // Should be proper case or all caps (for styled cards)
        const isProperCase = words.every(word =>
            /^[A-Z][a-z]*$/.test(word) || // Proper case
            /^[A-Z]+$/.test(word) ||       // All caps
            /^[A-Z][a-z]*\.$/.test(word)   // Abbreviation like "Jr."
        );

        // Check for common name patterns
        const hasNamePattern = /^[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+){0,3}$/.test(trimmed) ||
                              /^[A-Z]+(\s+[A-Z]+){0,3}$/.test(trimmed);

        return isProperCase || hasNamePattern;
    }

    async parseLogSheet(base64Image: string): Promise<LogSheetEntry[]> {
        console.log('[LogSheet] Parsing log sheet with Gemini...');

        const prompt = `You are an expert data extractor specializing in event log sheets and sign-in sheets. This image is a log sheet / sign-in sheet from an event, conference, or trade show. Each ROW in the sheet represents a DIFFERENT person who signed in.

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

## Examples

### Example 1: Tabular sign-in sheet with handwritten entries

Output:
[
  {"name": "Maria Santos", "company": "Acme Corp", "position": "Sales Manager", "phone": ["+63 917 555 1234"], "email": ["maria.santos@acme.com"], "address": "Makati City", "notes": "Booth interest"},
  {"name": "Dr. John Lee, MD", "company": "Health First Inc.", "position": "Medical Director", "phone": ["+63 2 8888 9999", "0917-222-3333"], "email": ["jlee@healthfirst.ph"], "address": "Quezon City", "notes": ""}
]

### Example 2: Stacked logo company name in a row

If a row contains a company written as "KINMO PW" on one visual line and "CORPORATION" on the next inside the same cell, return company as "KINMO PW Corporation" — never just "CORPORATION".

### Example 3: Phone column with multiple numbers separated by "/"

If a phone cell contains "8703-5284 / 8362-5820", split into the array ["8703-5284", "8362-5820"]. Never merge them.

Return ONLY a JSON array of objects. No explanation, no markdown.`;

        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

        const requestBody = JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } }
                ]
            }],
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: {
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
                            notes: { type: 'STRING' }
                        },
                        required: ['name', 'company', 'position', 'phone', 'email', 'address', 'notes']
                    }
                }
            }
        });

        const text = await callGeminiWithRetry({ body: requestBody, flowName: 'LogSheet', timeoutMs: 90000 });
        console.log('[LogSheet] Raw response:', text);

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('No JSON array in Gemini response');
            parsed = JSON.parse(jsonMatch[0]);
        }

        if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');

        return parsed
            .filter((e: any) => {
                const hasName = typeof e.name === 'string' && e.name.trim();
                const hasCompany = typeof e.company === 'string' && e.company.trim();
                const hasPhone = Array.isArray(e.phone) ? e.phone.some((p: string) => p?.trim()) : (typeof e.phone === 'string' && e.phone.trim());
                const hasEmail = Array.isArray(e.email) ? e.email.some((p: string) => p?.trim()) : (typeof e.email === 'string' && e.email.trim());
                return hasName || hasCompany || hasPhone || hasEmail;
            })
            .map((e: any) => {
                const entry = {
                    name: smartCapitalize(e.name || ''),
                    company: e.company || '',
                    position: e.position || '',
                    phone: Array.isArray(e.phone) ? e.phone.filter((p: string) => p?.trim()) : (e.phone ? [e.phone] : []),
                    email: Array.isArray(e.email) ? e.email.filter((p: string) => p?.trim()) : (e.email ? [e.email] : []),
                    address: e.address || '',
                    notes: e.notes || '',
                };
                return { ...entry, confidence: computeHeuristicConfidence(entry) };
            });
    }

    /**
     * Parse multiple business cards from a single photo.
     * Gemini identifies each card visually and returns separate contact entries.
     */
    async parseMultiCards(base64Image: string): Promise<LogSheetEntry[]> {
        console.log('[MultiCard] Parsing multiple cards with Gemini...');

        const prompt = `You are an expert business card data extractor. This image contains MULTIPLE business cards laid out together (on a table, desk, or surface).

## Task
1. Visually identify the boundaries of each SEPARATE business card in the image.
2. For EACH card, extract the person's contact information independently.
3. Each card MUST be a separate entry in the output array.
4. If a card is partially visible or too blurry, extract what you can — do not invent missing data.
5. Do NOT merge data from different cards into one entry.

${GEMINI_CORE_RULES}

## Example

If the photo shows three cards, return an array of three objects. Each object follows the same field rules as a single card scan.

For example, if one of the cards shows "KINMO PW" stacked above "CORPORATION", return company as "KINMO PW Corporation" — never just "CORPORATION".

If a card has multiple phone numbers separated by "/" or spaces, split them into separate array entries.

If a card has multiple labeled addresses (Main Office / Branch / BGC Office), include all of them in the address field with the format \`Label: address | Label: address\`.

Return ONLY a JSON array of objects. No explanation, no markdown.`;

        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

        const requestBody = JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } }
                ]
            }],
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: {
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
                            notes: { type: 'STRING' }
                        },
                        required: ['name', 'company', 'position', 'phone', 'email', 'address', 'notes']
                    }
                }
            }
        });

        const text = await callGeminiWithRetry({ body: requestBody, flowName: 'MultiCard', timeoutMs: 90000 });
        console.log('[MultiCard] Raw response:', text);

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('No JSON array in Gemini response');
            parsed = JSON.parse(jsonMatch[0]);
        }

        if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');

        return parsed
            .filter((e: any) => {
                const hasName = typeof e.name === 'string' && e.name.trim();
                const hasCompany = typeof e.company === 'string' && e.company.trim();
                const hasPhone = Array.isArray(e.phone) ? e.phone.some((p: string) => p?.trim()) : (typeof e.phone === 'string' && e.phone.trim());
                const hasEmail = Array.isArray(e.email) ? e.email.some((p: string) => p?.trim()) : (typeof e.email === 'string' && e.email.trim());
                return hasName || hasCompany || hasPhone || hasEmail;
            })
            .map((e: any) => {
                const entry = {
                    name: smartCapitalize(e.name || ''),
                    company: e.company || '',
                    position: e.position || '',
                    phone: Array.isArray(e.phone) ? e.phone.filter((p: string) => p?.trim()) : (e.phone ? [e.phone] : []),
                    email: Array.isArray(e.email) ? e.email.filter((p: string) => p?.trim()) : (e.email ? [e.email] : []),
                    address: e.address || '',
                    notes: e.notes || '',
                };
                return { ...entry, confidence: computeHeuristicConfidence(entry) };
            });
    }

    async terminate(): Promise<void> {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export interface LogSheetEntry {
    name: string;
    company: string;
    position: string;
    phone: string[];
    email: string[];
    address: string;
    notes: string;
    confidence: number;
}

export const ocrService = new OCRService();
