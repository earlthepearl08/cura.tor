/**
 * Field-level OCR confidence + needs-review assessment.
 * Combines Vision word scores (when available), Gemini uncertain-field flags,
 * and local validation heuristics — not a single fill-rate %.
 */

export type ContactFieldKey =
    | 'name'
    | 'company'
    | 'position'
    | 'phone'
    | 'email'
    | 'address'
    | 'notes';

export type ConfidenceSource = 'vision' | 'gemini' | 'heuristic' | 'tesseract' | 'mixed';

export type FieldConfidenceMap = Partial<Record<ContactFieldKey, number>>;

export const CONTACT_FIELD_KEYS: ContactFieldKey[] = [
    'name', 'company', 'position', 'phone', 'email', 'address', 'notes',
];

/** Flag a field for review when its score is below this (0–100). */
export const FIELD_REVIEW_THRESHOLD = 70;

/** Overall score below this marks the whole entry for review. */
export const ENTRY_REVIEW_THRESHOLD = 75;

export interface VisionWord {
    text: string;
    confidence: number; // 0–1 from Cloud Vision
}

export interface ContactFields {
    name?: string;
    company?: string;
    position?: string;
    phone?: string[] | string;
    email?: string[] | string;
    address?: string;
    notes?: string;
}

export interface EnrichedConfidence {
    confidence: number;
    confidenceSource: ConfidenceSource;
    fieldConfidence: FieldConfidenceMap;
    needsReviewFields: ContactFieldKey[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const UNCERTAIN_MARKERS = /[?�]|illegible|unclear|guess/i;

function hasValue(v: unknown): boolean {
    if (Array.isArray(v)) return v.length > 0 && v.some(x => typeof x === 'string' && x.trim().length > 0);
    return typeof v === 'string' && v.trim().length > 0;
}

function asStringList(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
}

function normalizeToken(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9@.+]/g, '');
}

/** Fill-rate heuristic (0–95). Used when no Vision/Gemini field scores exist. */
export function computeHeuristicConfidence(entry: ContactFields): number {
    let score = 55;
    if (hasValue(entry.name)) score += 12;
    if (hasValue(entry.company)) score += 10;
    if (hasValue(entry.phone)) score += 8;
    if (hasValue(entry.email)) score += 8;
    if (hasValue(entry.position)) score += 4;
    if (hasValue(entry.address)) score += 3;
    if (hasValue(entry.notes)) score += 2;
    return Math.max(0, Math.min(95, score));
}

/** Pull word-level confidence from Cloud Vision fullTextAnnotation.pages. */
export function extractVisionWords(fullTextAnnotation: any): VisionWord[] {
    const words: VisionWord[] = [];
    const pages = fullTextAnnotation?.pages;
    if (!pages?.length) return words;

    for (const page of pages) {
        for (const block of page.blocks || []) {
            for (const paragraph of block.paragraphs || []) {
                for (const word of paragraph.words || []) {
                    if (word.confidence === undefined) continue;
                    const text = (word.symbols || [])
                        .map((s: any) => s.text || '')
                        .join('');
                    if (!text.trim()) continue;
                    words.push({ text, confidence: word.confidence });
                }
            }
        }
    }
    return words;
}

export function averageVisionConfidence(words: VisionWord[]): number | null {
    if (!words.length) return null;
    const avg = words.reduce((a, w) => a + w.confidence, 0) / words.length;
    return Math.round(avg * 100);
}

/**
 * Match field values against Vision words and average matching word scores.
 * Returns 0–100 per field that had at least one token match.
 */
export function fieldConfidenceFromVision(
    entry: ContactFields,
    words: VisionWord[],
): FieldConfidenceMap {
    if (!words.length) return {};

    const byNorm = new Map<string, number[]>();
    for (const w of words) {
        const key = normalizeToken(w.text);
        if (!key) continue;
        const list = byNorm.get(key) || [];
        list.push(w.confidence);
        byNorm.set(key, list);
    }

    const scoreField = (raw: string): number | undefined => {
        const tokens = raw.split(/\s+/).map(normalizeToken).filter(t => t.length >= 2);
        if (!tokens.length) return undefined;
        const matched: number[] = [];
        for (const t of tokens) {
            const scores = byNorm.get(t);
            if (scores?.length) {
                matched.push(scores.reduce((a, b) => a + b, 0) / scores.length);
            }
        }
        if (!matched.length) return undefined;
        return Math.round((matched.reduce((a, b) => a + b, 0) / matched.length) * 100);
    };

    const out: FieldConfidenceMap = {};
    const stringFields: ContactFieldKey[] = ['name', 'company', 'position', 'address', 'notes'];
    for (const key of stringFields) {
        const val = entry[key];
        if (typeof val === 'string' && val.trim()) {
            const s = scoreField(val);
            if (s !== undefined) out[key] = s;
        }
    }
    for (const key of ['phone', 'email'] as ContactFieldKey[]) {
        const parts = asStringList(entry[key]);
        if (!parts.length) continue;
        const scores = parts.map(p => scoreField(p)).filter((n): n is number => n !== undefined);
        if (scores.length) {
            out[key] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
    }
    return out;
}

/** Local validation: format / emptiness issues that should force review. */
export function heuristicUncertainFields(entry: ContactFields): ContactFieldKey[] {
    const flagged = new Set<ContactFieldKey>();

    const name = (entry.name || '').trim();
    if (!name) {
        flagged.add('name');
    } else if (name.length < 2 || UNCERTAIN_MARKERS.test(name) || /^[a-z]$/i.test(name)) {
        flagged.add('name');
    }

    const emails = asStringList(entry.email);
    if (emails.length > 0 && emails.some(e => !EMAIL_RE.test(e.trim()))) {
        flagged.add('email');
    }

    const phones = asStringList(entry.phone);
    if (phones.length > 0) {
        const bad = phones.some(p => {
            const digits = p.replace(/\D/g, '');
            return digits.length > 0 && digits.length < 7;
        });
        if (bad) flagged.add('phone');
    }

    for (const key of CONTACT_FIELD_KEYS) {
        const val = entry[key];
        if (typeof val === 'string' && UNCERTAIN_MARKERS.test(val)) flagged.add(key);
        if (Array.isArray(val) && val.some(v => typeof v === 'string' && UNCERTAIN_MARKERS.test(v))) {
            flagged.add(key);
        }
    }

    // Critical contact identity missing both name and company
    if (!hasValue(entry.name) && !hasValue(entry.company)) {
        flagged.add('name');
        flagged.add('company');
    }

    return Array.from(flagged);
}

function normalizeUncertainList(raw: unknown): ContactFieldKey[] {
    if (!Array.isArray(raw)) return [];
    const allowed = new Set<string>(CONTACT_FIELD_KEYS);
    return raw
        .map(x => (typeof x === 'string' ? x.trim().toLowerCase() : ''))
        .filter((x): x is ContactFieldKey => allowed.has(x));
}

function parseGeminiFieldScores(raw: unknown): FieldConfidenceMap {
    if (!raw || typeof raw !== 'object') return {};
    const out: FieldConfidenceMap = {};
    for (const key of CONTACT_FIELD_KEYS) {
        const n = (raw as Record<string, unknown>)[key];
        if (typeof n === 'number' && Number.isFinite(n)) {
            out[key] = Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
        }
    }
    return out;
}

/**
 * Build overall + per-field confidence and needs-review flags.
 */
export function enrichConfidence(
    entry: ContactFields,
    opts: {
        visionWords?: VisionWord[];
        geminiUncertainFields?: unknown;
        geminiFieldConfidence?: unknown;
        baseSource?: ConfidenceSource;
        /** Overall from engine (Vision avg / Tesseract) when known */
        engineOverall?: number;
    } = {},
): EnrichedConfidence {
    const visionFields = opts.visionWords?.length
        ? fieldConfidenceFromVision(entry, opts.visionWords)
        : {};
    const geminiFields = parseGeminiFieldScores(opts.geminiFieldConfidence);
    const geminiUncertain = normalizeUncertainList(opts.geminiUncertainFields);
    const heuristicFlags = heuristicUncertainFields(entry);

    const fieldConfidence: FieldConfidenceMap = { ...geminiFields, ...visionFields };

    // Seed missing populated fields from overall heuristic so UI has something to show
    const fillHeuristic = computeHeuristicConfidence(entry);
    for (const key of CONTACT_FIELD_KEYS) {
        if (fieldConfidence[key] !== undefined) continue;
        const val = entry[key];
        if (!hasValue(val)) continue;
        // Slightly lower default for optional fields when only fill-rate is known
        fieldConfidence[key] = key === 'name' || key === 'company' || key === 'email' || key === 'phone'
            ? fillHeuristic
            : Math.min(fillHeuristic, 80);
    }

    // Force low scores on Gemini/heuristic uncertain fields
    for (const key of [...geminiUncertain, ...heuristicFlags]) {
        const current = fieldConfidence[key];
        fieldConfidence[key] = Math.min(current ?? FIELD_REVIEW_THRESHOLD - 1, FIELD_REVIEW_THRESHOLD - 5);
    }

    const needsReviewFields = Array.from(new Set<ContactFieldKey>([
        ...geminiUncertain,
        ...heuristicFlags,
        ...CONTACT_FIELD_KEYS.filter(k => {
            const score = fieldConfidence[k];
            return score !== undefined && score < FIELD_REVIEW_THRESHOLD && hasValue(entry[k]);
        }),
        // Empty name is always review-worthy on log rows
        ...(!hasValue(entry.name) ? (['name'] as ContactFieldKey[]) : []),
    ]));

    let confidenceSource: ConfidenceSource = opts.baseSource || 'heuristic';
    if (opts.visionWords?.length && (geminiUncertain.length || Object.keys(geminiFields).length)) {
        confidenceSource = 'mixed';
    } else if (opts.visionWords?.length) {
        confidenceSource = 'vision';
    } else if (geminiUncertain.length || Object.keys(geminiFields).length) {
        confidenceSource = 'gemini';
    } else if (opts.baseSource) {
        confidenceSource = opts.baseSource;
    }

    let confidence: number;
    if (opts.engineOverall !== undefined && Number.isFinite(opts.engineOverall)) {
        confidence = Math.round(opts.engineOverall);
    } else {
        const scored = CONTACT_FIELD_KEYS
            .map(k => fieldConfidence[k])
            .filter((n): n is number => n !== undefined);
        if (scored.length >= 2) {
            confidence = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
        } else {
            confidence = fillHeuristic;
        }
    }

    // Penalize overall when many fields need review
    if (needsReviewFields.length > 0) {
        confidence = Math.min(confidence, 100 - needsReviewFields.length * 4);
        confidence = Math.min(confidence, ENTRY_REVIEW_THRESHOLD - 1);
    }

    confidence = Math.max(0, Math.min(100, confidence));

    return {
        confidence,
        confidenceSource,
        fieldConfidence,
        needsReviewFields,
    };
}

export function entryNeedsReview(
    needsReviewFields: ContactFieldKey[] | undefined,
    confidence: number,
    resolved?: boolean,
): boolean {
    if (resolved) return false;
    if (needsReviewFields && needsReviewFields.length > 0) return true;
    return confidence < ENTRY_REVIEW_THRESHOLD;
}

/** Shared Gemini JSON schema fragment for confidence fields on contact objects. */
export const GEMINI_CONFIDENCE_SCHEMA_PROPS = {
    uncertainFields: {
        type: 'ARRAY' as const,
        items: { type: 'STRING' as const },
    },
    fieldConfidence: {
        type: 'OBJECT' as const,
        properties: {
            name: { type: 'NUMBER' as const },
            company: { type: 'NUMBER' as const },
            position: { type: 'NUMBER' as const },
            phone: { type: 'NUMBER' as const },
            email: { type: 'NUMBER' as const },
            address: { type: 'NUMBER' as const },
            notes: { type: 'NUMBER' as const },
        },
    },
};

export const GEMINI_CONFIDENCE_PROMPT = `
## Confidence (required)
For each entry also return:
- "uncertainFields": string array of field names you are unsure about (handwriting unclear, partial, guessed, or low visual quality). Use only: name, company, position, phone, email, address, notes. Use [] if confident in all filled fields.
- "fieldConfidence": object mapping those same field names to 0–100 scores for fields you filled. Omit empty fields. Be conservative on handwriting.
`.trim();
