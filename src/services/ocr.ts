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

export type OCREngine = 'tesseract' | 'gemini-vision';

// Gemini API Key - users should set this in localStorage
const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';

export const getGeminiApiKey = (): string | null => {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
};

export const setGeminiApiKey = (key: string): void => {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
};

export const getOCREngine = (): OCREngine => {
    return (localStorage.getItem('ocr_engine') as OCREngine) || 'tesseract';
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
    'manager', 'supervisor', 'lead', 'team lead', 'coordinator',
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
    'philippines', 'ph', 'usa', 'uk'
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

    /**
     * Process image using Gemini Vision API (direct multimodal)
     * Bypasses OCR entirely - sends image directly to Gemini
     */
    async processImageWithGeminiVision(imageSrc: string): Promise<OCRResult> {
        console.log('[Gemini Vision] Starting direct image analysis...');

        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            throw new Error('Gemini API key not configured. Please add your API key in Settings.');
        }

        try {
            // Convert image to base64 (remove data URL prefix if present)
            const base64Image = imageSrc.replace(/^data:image\/\w+;base64,/, '');

            const prompt = `You are an expert at extracting contact information from business cards. Analyze this business card image and extract ALL contact details with perfect accuracy.

**CRITICAL REQUIREMENTS:**
1. **Support ALL languages** - English, Japanese (日本語), Chinese (中文), Thai (ภาษาไทย), Korean (한국어), Spanish, etc.
2. **Preserve professional titles** - Keep "Engr.", "Dr.", "Mr.", "Prof.", "Atty.", etc. as part of the name
3. **Handle ANY card design** - Stylized fonts, logos, vertical/horizontal layouts, multi-column formats
4. **Extract complete addresses** - Include ALL parts (building, floor, street, district, city, province, postal code, country)
5. **Recognize visual context** - Use logos, colors, layout to understand company vs personal info

**OUTPUT FORMAT (strict JSON only):**
{
  "name": "Full name with title if present (e.g., 'Engr. John Doe', '田中太郎', 'Dr. Maria Santos')",
  "position": "Job title (e.g., 'Chief Engineer', '営業部長', 'Managing Director')",
  "company": "Company name with suffix (e.g., 'TechCorp Inc.', '株式会社サンプル', 'บริษัท ไทยเทค จำกัด')",
  "phone": ["All phone numbers as array"],
  "email": ["All email addresses as array"],
  "address": "Complete full address with ALL components, NO character limit",
  "confidence": 95
}

**EXAMPLES of correct output:**
- Japanese: {"name": "田中 太郎", "position": "営業部長", "company": "株式会社テクノロジー", ...}
- Thai: {"name": "สมชาย ใจดี", "company": "บริษัท ไทยเทค จำกัด", ...}
- With title: {"name": "Engr. Juan dela Cruz", "position": "Senior Engineer", ...}

Return ONLY the JSON object, no markdown, no code blocks, no explanation.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Image
                                    }
                                }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[Gemini Vision] Response received:', data);

            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error('Empty response from Gemini Vision');
            }

            // Extract JSON from response (handle markdown code blocks)
            let jsonText = text.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            }

            const parsed = JSON.parse(jsonText);

            // Validate and structure the result
            const result: OCRResult = {
                name: parsed.name || '',
                position: parsed.position || '',
                company: parsed.company || '',
                phone: Array.isArray(parsed.phone) ? parsed.phone : (parsed.phone ? [parsed.phone] : []),
                email: Array.isArray(parsed.email) ? parsed.email : (parsed.email ? [parsed.email] : []),
                address: parsed.address || '',
                rawText: `Gemini Vision Direct Analysis\n\nExtracted by AI multimodal vision (no OCR step)`,
                confidence: parsed.confidence || 95
            };

            console.log('[Gemini Vision] Extracted data:', result);
            return result;

        } catch (error) {
            console.error('[Gemini Vision] Error:', error);
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
        if (selectedEngine === 'gemini-vision') {
            return this.processImageWithGeminiVision(imageSrc);
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

    private parseText(text: string): Omit<OCRResult, 'rawText' | 'confidence'> {
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

        // Mark lines containing phones/emails as used
        for (let i = 0; i < lines.length; i++) {
            if (this.isPhoneLine(lines[i], result.phone) || this.isEmailLine(lines[i], result.email)) {
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

        // Remove duplicates (same digits)
        const seen = new Set<string>();
        return cleaned.filter(phone => {
            const digits = phone.replace(/\D/g, '');
            if (seen.has(digits)) return false;
            seen.add(digits);
            return true;
        });
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

        // Look for lines with company suffixes
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;

            const line = lines[i];
            const lineLower = line.toLowerCase();

            // Check for company suffixes
            const hasCompanySuffix = COMPANY_SUFFIXES.some(suffix => {
                const regex = new RegExp(`\\b${suffix}\\b`, 'i');
                return regex.test(lineLower);
            });

            if (hasCompanySuffix) {
                return { company: line, lineIndex: i };
            }

            // Check for ALL CAPS lines (often company names/logos)
            if (line === line.toUpperCase() && line.length > 3 && /^[A-Z\s&]+$/.test(line)) {
                return { company: line, lineIndex: i };
            }
        }

        // If we found a company from email, use that
        if (emailDomainCompany) {
            return { company: emailDomainCompany, lineIndex: -1 };
        }

        // Fallback: first unused line that's not a name pattern
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];
            // Skip if it looks like a person's name (2-3 words, proper case)
            if (this.looksLikeName(line)) continue;
            // Skip if contains email or phone
            if (/@/.test(line) || /\d{3,}/.test(line)) continue;
            return { company: line, lineIndex: i };
        }

        return { company: '', lineIndex: -1 };
    }

    private getCompanyFromEmail(emails: string[]): string | null {
        if (emails.length === 0) return null;

        const email = emails[0];
        const domain = email.split('@')[1];
        if (!domain) return null;

        // Remove common email providers
        const genericDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'mail', 'aol'];
        const domainName = domain.split('.')[0].toLowerCase();

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
        // First pass: look for lines that strongly look like names
        for (let i = 0; i < lines.length; i++) {
            if (usedLines.has(i)) continue;

            const line = lines[i];

            // Skip lines with email or phone content
            if (result.email.some(e => line.toLowerCase().includes(e))) continue;
            if (/@/.test(line)) continue;
            if (this.isPhoneLine(line, result.phone)) continue;

            // Skip very short lines (likely OCR artifacts)
            if (line.length < 3) continue;

            // Skip lines with too many special characters (OCR noise)
            const specialChars = (line.match(/[|@#$%^&*()_+=\[\]{}\\/<>]/g) || []).length;
            if (specialChars > 1) continue;

            if (this.looksLikeName(line)) {
                return line;
            }
        }

        // Second pass: look for any reasonable text line near the top
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            if (usedLines.has(i)) continue;
            const line = lines[i];

            // Skip lines with problematic content
            if (/@/.test(line)) continue;
            if (/\d{4,}/.test(line)) continue;
            if (this.isPhoneLine(line, result.phone)) continue;
            if (line.length < 3) continue;

            // Skip lines with too many special characters
            const specialChars = (line.match(/[|@#$%^&*()_+=\[\]{}\\/<>]/g) || []).length;
            if (specialChars > 1) continue;

            // Accept if it's mostly letters
            const letterRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
            if (letterRatio > 0.7) {
                return line;
            }
        }

        return '';
    }

    private looksLikeName(text: string): boolean {
        // Trim and check basic structure
        const trimmed = text.trim();

        // Names are typically 2-4 words
        const words = trimmed.split(/\s+/);
        if (words.length < 1 || words.length > 5) return false;

        // Should be mostly letters
        const letterRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
        if (letterRatio < 0.8) return false;

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
