// @ts-ignore - Types available after npm install
import { createWorker } from 'tesseract.js';

export interface OCRResult {
    name: string;
    position: string;
    company: string;
    phone: string[];
    email: string[];
    address: string;
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

export class OCRService {
    private worker: any = null;
    private isInitializing: boolean = false;
    private currentEngine: OCREngine = getOCREngine();

    private apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';

    /**
     * Process image using Google Cloud Vision API for OCR,
     * then Gemini AI for intelligent parsing (with rule-based fallback)
     */
    async processImageWithCloudVision(imageSrc: string): Promise<OCRResult> {
        console.log('[Cloud Vision] Starting image analysis...');

        try {
            const base64Image = imageSrc.replace(/^data:image\/\w+;base64,/, '');

            const response = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [{
                            image: { content: base64Image },
                            features: [
                                { type: 'DOCUMENT_TEXT_DETECTION' }
                            ],
                            imageContext: {
                                languageHints: ['en', 'tl', 'zh', 'ja', 'ko']
                            }
                        }]
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Cloud Vision API error: ${response.status}`);
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
                parsedData = await this.parseWithGemini(fullText, base64Image);
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
        console.log('[Gemini] Parsing text with AI...');

        const prompt = `You are an expert business card data extractor. Your task is to parse raw OCR text from a business card and extract structured contact information.

## Rules

1. "name" MUST be the PERSON's full name (first name + last name), including any professional credentials/designations that appear with it (e.g., "Dr. John Smith, MD, PhD", "Jane Cruz, REE, PEE", "Engr. Maria Santos, MSEE"). Include prefixes (Dr., Engr., Atty., Arch.) and suffixes (MD, PhD, CPA, REE, PEE, PE, MBA, MSEE, RN, DDS, Esq., Jr., Sr., III) as part of the name. It is NEVER a company name, brand, tagline, website, or abbreviation.
2. "company" is the registered business entity name. It often includes suffixes like Inc., Ltd., Corp., LLC, Pte Ltd, Co., etc. It is NOT a tagline or slogan.
3. "position" is the person's job title or role (e.g., "Senior Sales Manager", "VP of Engineering"). Department names alone (e.g., "Marketing Department") are NOT positions unless combined with a title.
4. Phone numbers must include country codes when visible. Prefix with "+" if a country code is present. Include ALL phone numbers (mobile, office, direct, fax). Label fax numbers with "(Fax)" suffix.
5. Include ALL email addresses found.
6. "address" is the full physical/mailing address. Combine multiple address lines into one string, separated by commas.
7. If a field cannot be determined, use an empty string "" for strings or [] for arrays.
8. Do NOT invent or guess information that is not present in the text.
9. If professional credentials appear on a SEPARATE line from the name (e.g., name on one line, "PhD, REE, PEE" on the next), combine them into the name field.

## Examples

Input:
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
{"name": "John Michael Santos", "position": "Regional Sales Director", "company": "Clearpack Technology (Phils.) Inc.", "phone": ["+63 917 123 4567", "+63 2 8888 1234", "+63 2 8888 1235 (Fax)"], "email": ["john.santos@ph.clearpack.com"], "address": "Unit 5B Pacific Star Bldg., Makati Ave., Makati City 1226, Philippines"}

Input:
SAMSUNG
Maria Theresa O'Brien-Cruz, CPA
Finance Manager
Samsung Electronics Philippines Corp.
tel (02) 7756-2000
mob 0917-555-8888
maria.cruz@samsung.com
BGC, Taguig City

Output:
{"name": "Maria Theresa O'Brien-Cruz, CPA", "position": "Finance Manager", "company": "Samsung Electronics Philippines Corp.", "phone": ["(02) 7756-2000", "0917-555-8888"], "email": ["maria.cruz@samsung.com"], "address": "BGC, Taguig City"}

Input:
Dr. Wei Lin Chen
Associate Professor
Department of Computer Science
National University of Singapore
13 Computing Drive, Singapore 117417
+65 6516 1234
weichen@comp.nus.edu.sg

Output:
{"name": "Dr. Wei Lin Chen", "position": "Associate Professor, Department of Computer Science", "company": "National University of Singapore", "phone": ["+65 6516 1234"], "email": ["weichen@comp.nus.edu.sg"], "address": "13 Computing Drive, Singapore 117417"}

Input:
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
{"name": "Engr. Roberto M. Dela Cruz, REE, PEE, MSEE", "position": "Vice President - Technical Operations", "company": "PhilEnergy Power Solutions Corp.", "phone": ["+63 917 888 9999", "+63 2 8812 3456", "+63 2 8812 3457 (Fax)"], "email": ["roberto.delacruz@philenergy.com.ph"], "address": "Unit 12F Rockwell Business Center, Makati City 1210, Philippines"}

## Business Card Text to Parse

<card_text>
${rawText}
</card_text>

Return ONLY the JSON object. No explanation, no markdown.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            // Build multimodal content parts: text prompt + optional image
            const parts: any[] = [{ text: prompt }];
            if (base64Image) {
                parts.push({
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: base64Image
                    }
                });
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
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
                                    address: { type: 'STRING' }
                                },
                                required: ['name', 'position', 'company', 'phone', 'email', 'address']
                            }
                        }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No response from Gemini');

            console.log('[Gemini] Raw response:', text);

            // With responseMimeType: 'application/json', response is guaranteed valid JSON
            // But keep fallback parsing just in case
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
                name: parsed.name || '',
                position: parsed.position || '',
                company: parsed.company || '',
                phone: Array.isArray(parsed.phone) ? parsed.phone : parsed.phone ? [parsed.phone] : [],
                email: Array.isArray(parsed.email) ? parsed.email : parsed.email ? [parsed.email] : [],
                address: parsed.address || ''
            };
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
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

        // Route to appropriate engine
        if (selectedEngine === 'cloud-vision') {
            return this.processImageWithCloudVision(imageSrc);
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
            address: ''
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
        result.name = this.extractName(lines, usedLines, result);

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

    async terminate(): Promise<void> {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const ocrService = new OCRService();
