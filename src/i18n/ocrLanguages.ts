/**
 * OCR language catalog for Gemini / Cloud Vision / Tesseract.
 * Focused on EN + PH / ASEAN / East Asia trade-show mixes.
 */

export type OcrLanguageId =
    | 'en'
    | 'fil'
    | 'zh-Hans'
    | 'zh-Hant'
    | 'ja'
    | 'ko'
    | 'es'
    | 'id'
    | 'vi'
    | 'th'
    | 'ar'
    | 'fr'
    | 'de';

export interface OcrLanguageOption {
    id: OcrLanguageId;
    /** English UI label */
    label: string;
    /** Native / local label */
    nativeLabel: string;
    /** Short note for Settings */
    note?: string;
    /** Tesseract.js traineddata code */
    tesseractCode: string;
    /** Cloud Vision languageHints value */
    visionHint: string;
    /** Name used in Gemini prompts */
    geminiName: string;
}

export const OCR_LANGUAGE_OPTIONS: OcrLanguageOption[] = [
    { id: 'en', label: 'English', nativeLabel: 'English', note: 'Default', tesseractCode: 'eng', visionHint: 'en', geminiName: 'English' },
    { id: 'fil', label: 'Filipino', nativeLabel: 'Filipino / Tagalog', note: 'PH', tesseractCode: 'tgl', visionHint: 'tl', geminiName: 'Filipino (Tagalog)' },
    { id: 'zh-Hans', label: 'Chinese (Simplified)', nativeLabel: '简体中文', note: 'Trade shows', tesseractCode: 'chi_sim', visionHint: 'zh', geminiName: 'Simplified Chinese' },
    { id: 'zh-Hant', label: 'Chinese (Traditional)', nativeLabel: '繁體中文', tesseractCode: 'chi_tra', visionHint: 'zh-TW', geminiName: 'Traditional Chinese' },
    { id: 'ja', label: 'Japanese', nativeLabel: '日本語', tesseractCode: 'jpn', visionHint: 'ja', geminiName: 'Japanese' },
    { id: 'ko', label: 'Korean', nativeLabel: '한국어', tesseractCode: 'kor', visionHint: 'ko', geminiName: 'Korean' },
    { id: 'es', label: 'Spanish', nativeLabel: 'Español', tesseractCode: 'spa', visionHint: 'es', geminiName: 'Spanish' },
    { id: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', note: 'ASEAN', tesseractCode: 'ind', visionHint: 'id', geminiName: 'Indonesian' },
    { id: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', tesseractCode: 'vie', visionHint: 'vi', geminiName: 'Vietnamese' },
    { id: 'th', label: 'Thai', nativeLabel: 'ไทย', tesseractCode: 'tha', visionHint: 'th', geminiName: 'Thai' },
    { id: 'ar', label: 'Arabic', nativeLabel: 'العربية', tesseractCode: 'ara', visionHint: 'ar', geminiName: 'Arabic' },
    { id: 'fr', label: 'French', nativeLabel: 'Français', tesseractCode: 'fra', visionHint: 'fr', geminiName: 'French' },
    { id: 'de', label: 'German', nativeLabel: 'Deutsch', tesseractCode: 'deu', visionHint: 'de', geminiName: 'German' },
];

const STORAGE_KEY = 'ocr_languages';
const DEFAULT_LANGS: OcrLanguageId[] = ['en'];
/** Cap multi-select so Tesseract downloads stay reasonable */
export const MAX_OCR_LANGUAGES = 4;

const OPTION_BY_ID = new Map(OCR_LANGUAGE_OPTIONS.map(o => [o.id, o]));

export function getOcrLanguageOption(id: OcrLanguageId): OcrLanguageOption | undefined {
    return OPTION_BY_ID.get(id);
}

export function getSelectedOcrLanguageIds(): OcrLanguageId[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_LANGS];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [...DEFAULT_LANGS];
        const valid = parsed.filter((id: unknown): id is OcrLanguageId =>
            typeof id === 'string' && OPTION_BY_ID.has(id as OcrLanguageId)
        );
        return valid.length > 0 ? valid.slice(0, MAX_OCR_LANGUAGES) : [...DEFAULT_LANGS];
    } catch {
        return [...DEFAULT_LANGS];
    }
}

export function setSelectedOcrLanguageIds(ids: OcrLanguageId[]): void {
    const unique = Array.from(new Set(ids)).filter(id => OPTION_BY_ID.has(id));
    const next = (unique.length > 0 ? unique : DEFAULT_LANGS).slice(0, MAX_OCR_LANGUAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function toggleOcrLanguage(id: OcrLanguageId): OcrLanguageId[] {
    const current = getSelectedOcrLanguageIds();
    let next: OcrLanguageId[];
    if (current.includes(id)) {
        next = current.filter(x => x !== id);
        if (next.length === 0) next = [...DEFAULT_LANGS];
    } else if (current.length >= MAX_OCR_LANGUAGES) {
        next = current; // at cap
    } else {
        next = [...current, id];
    }
    setSelectedOcrLanguageIds(next);
    return getSelectedOcrLanguageIds();
}

export function getSelectedOcrLanguageOptions(): OcrLanguageOption[] {
    return getSelectedOcrLanguageIds()
        .map(id => OPTION_BY_ID.get(id))
        .filter((o): o is OcrLanguageOption => !!o);
}

/** Tesseract multi-lang string, e.g. "eng+tgl+chi_sim" */
export function getTesseractLangString(ids?: OcrLanguageId[]): string {
    const opts = (ids || getSelectedOcrLanguageIds())
        .map(id => OPTION_BY_ID.get(id)?.tesseractCode)
        .filter((c): c is string => !!c);
    const unique = Array.from(new Set(opts.length ? opts : ['eng']));
    return unique.join('+');
}

/** Cloud Vision languageHints */
export function getVisionLanguageHints(ids?: OcrLanguageId[]): string[] {
    const hints = (ids || getSelectedOcrLanguageIds())
        .map(id => OPTION_BY_ID.get(id)?.visionHint)
        .filter((h): h is string => !!h);
    return hints.length ? Array.from(new Set(hints)) : ['en'];
}

/** Human-readable list for UI chips */
export function formatOcrLanguageSummary(ids?: OcrLanguageId[]): string {
    const opts = (ids || getSelectedOcrLanguageIds())
        .map(id => OPTION_BY_ID.get(id)?.label)
        .filter(Boolean);
    return opts.length ? opts.join(', ') : 'English';
}

/**
 * Prompt block injected into Gemini card / log / multi-card flows.
 * Instructs the model to read selected languages without translating values.
 */
export function buildGeminiLanguagePromptSection(ids?: OcrLanguageId[]): string {
    const opts = getSelectedOcrLanguageOptions();
    const selected = ids
        ? ids.map(id => OPTION_BY_ID.get(id)).filter((o): o is OcrLanguageOption => !!o)
        : opts;
    const list = (selected.length ? selected : [OPTION_BY_ID.get('en')!])
        .map(o => o.geminiName)
        .join(', ');

    return `## Languages
Expected text languages on this image: ${list}.
- Read and preserve text in those languages (and Latin script mixed with them).
- Do NOT translate personal names, company names, addresses, or notes into English — keep the original wording and script.
- Job titles and headers may appear in a local language; keep values as written.
- JSON property names stay in English; only field values use the source language.`;
}
