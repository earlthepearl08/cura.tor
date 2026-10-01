import type { LogSheetEntry } from './ocr';
import {
    LOG_SHEET_FIELD_KEYS,
    LogSheetColumnMapping,
    LogSheetFieldKey,
    LogSheetParseMeta,
} from '@/types/logSheet';

function hasValue(v: unknown): boolean {
    if (Array.isArray(v)) return v.some(x => typeof x === 'string' && x.trim().length > 0);
    return typeof v === 'string' && v.trim().length > 0;
}

function emptyMeta(): LogSheetParseMeta {
    return {
        detectedHeaders: [],
        suggestedMapping: {},
        headersAmbiguous: false,
        ambiguityReasons: [],
    };
}

/** Normalize Gemini / partial meta into a safe LogSheetParseMeta. */
export function normalizeParseMeta(raw: any, entries: LogSheetEntry[]): LogSheetParseMeta {
    if (!raw || typeof raw !== 'object') {
        return assessAmbiguityFromEntries(entries, emptyMeta());
    }

    const detectedHeaders = Array.isArray(raw.detectedHeaders)
        ? raw.detectedHeaders.filter((h: unknown): h is string => typeof h === 'string' && h.trim().length > 0).map((h: string) => h.trim())
        : [];

    const suggestedMapping: LogSheetColumnMapping = {};
    const rawMap = raw.suggestedMapping && typeof raw.suggestedMapping === 'object' ? raw.suggestedMapping : {};
    for (const key of LOG_SHEET_FIELD_KEYS) {
        const v = rawMap[key];
        if (typeof v === 'string' && v.trim()) suggestedMapping[key] = v.trim();
    }

    const ambiguityReasons = Array.isArray(raw.ambiguityReasons)
        ? raw.ambiguityReasons.filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)
        : [];

    let headersAmbiguous = Boolean(raw.headersAmbiguous);

    const meta: LogSheetParseMeta = {
        detectedHeaders,
        suggestedMapping,
        headersAmbiguous,
        ambiguityReasons,
    };

    return assessAmbiguityFromEntries(entries, meta);
}

/**
 * Heuristic fallthrough: flag ambiguous headers when fill patterns look wrong
 * even if the model said it was confident.
 */
export function assessAmbiguityFromEntries(
    entries: LogSheetEntry[],
    meta: LogSheetParseMeta,
): LogSheetParseMeta {
    if (!entries.length) return meta;

    const reasons = [...meta.ambiguityReasons];
    let ambiguous = meta.headersAmbiguous;

    const missingName = entries.filter(e => !hasValue(e.name)).length / entries.length;
    const missingCompany = entries.filter(e => !hasValue(e.company)).length / entries.length;
    const hasPhone = entries.filter(e => hasValue(e.phone)).length / entries.length;
    const hasEmail = entries.filter(e => hasValue(e.email)).length / entries.length;
    const hasNotes = entries.filter(e => hasValue(e.notes)).length / entries.length;

    if (missingName > 0.4) {
        ambiguous = true;
        reasons.push('Many rows are missing a name — the Name column may be mislabeled.');
    }
    if (missingName > 0.5 && hasNotes > 0.5) {
        ambiguous = true;
        reasons.push('Notes are filled more often than names — columns may be swapped.');
    }
    if (missingCompany > 0.7 && (hasPhone > 0.4 || hasEmail > 0.4)) {
        // Not always ambiguous (some sheets omit company), but with odd headers help
        if (meta.detectedHeaders.some(h => /org|firm|company|affiliation|school/i.test(h))) {
            ambiguous = true;
            reasons.push('A company-like header was detected but company values are sparse.');
        }
    }

    // Duplicate header targets in suggested mapping
    const used = Object.values(meta.suggestedMapping).filter(Boolean);
    if (new Set(used).size < used.length) {
        ambiguous = true;
        reasons.push('Two fields map to the same header.');
    }

    // Unmapped detected headers that look important
    const mappedHeaders = new Set(used.map(h => h.toLowerCase()));
    const unmappedImportant = meta.detectedHeaders.filter(h => {
        if (mappedHeaders.has(h.toLowerCase())) return false;
        return /name|company|org|phone|mobile|email|mail|title|position|interest|booth|purpose|remarks/i.test(h);
    });
    if (unmappedImportant.length > 0) {
        ambiguous = true;
        reasons.push(`Unmapped column${unmappedImportant.length > 1 ? 's' : ''}: ${unmappedImportant.join(', ')}`);
    }

    return {
        ...meta,
        headersAmbiguous: ambiguous,
        ambiguityReasons: Array.from(new Set(reasons)),
    };
}

function getFieldValue(entry: LogSheetEntry, field: LogSheetFieldKey): string | string[] {
    return entry[field];
}

function setFieldValue(entry: LogSheetEntry, field: LogSheetFieldKey, value: string | string[]): void {
    if (field === 'phone' || field === 'email') {
        entry[field] = Array.isArray(value) ? value : (value ? [value] : []);
    } else {
        entry[field] = (Array.isArray(value) ? value.join(', ') : value) || '';
    }
}

/**
 * Remap entry field values when the user changes header→field assignments.
 * Works by treating each detected header as a bucket (via the old mapping),
 * then writing buckets into fields per the new mapping.
 */
export function remapEntries(
    entries: LogSheetEntry[],
    previous: LogSheetColumnMapping,
    next: LogSheetColumnMapping,
): LogSheetEntry[] {
    const prevJson = JSON.stringify(previous);
    const nextJson = JSON.stringify(next);
    if (prevJson === nextJson) return entries;

    return entries.map(original => {
        const entry = { ...original, phone: [...original.phone], email: [...original.email] };

        // header label → value from previous field assignment
        const byHeader = new Map<string, string | string[]>();
        for (const field of LOG_SHEET_FIELD_KEYS) {
            const header = previous[field];
            if (!header) continue;
            byHeader.set(header.toLowerCase(), getFieldValue(entry, field));
        }

        // Clear fields that will be reassigned
        for (const field of LOG_SHEET_FIELD_KEYS) {
            if (next[field] || previous[field]) {
                setFieldValue(entry, field, field === 'phone' || field === 'email' ? [] : '');
            }
        }

        for (const field of LOG_SHEET_FIELD_KEYS) {
            const header = next[field];
            if (!header) continue;
            const value = byHeader.get(header.toLowerCase());
            if (value !== undefined) setFieldValue(entry, field, value);
        }

        return entry;
    });
}

/** Format mapping as short prompt lines for Gemini follow-up sheets. */
export function mappingToPromptHint(mapping: LogSheetColumnMapping): string {
    const lines = LOG_SHEET_FIELD_KEYS
        .filter(k => mapping[k])
        .map(k => `- "${mapping[k]}" → ${k}`);
    if (!lines.length) return '';
    return `## Confirmed column mapping (use exactly)\n${lines.join('\n')}`;
}

export function mappingsEqual(a?: LogSheetColumnMapping, b?: LogSheetColumnMapping): boolean {
    return JSON.stringify(a || {}) === JSON.stringify(b || {});
}
