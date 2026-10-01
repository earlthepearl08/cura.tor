import { LogSheetEntry } from '@/services/ocr';
import {
    ColumnMapping,
    ColumnMappingTarget,
    StandardContactField,
    STANDARD_FIELD_OPTIONS,
} from '@/types/eventTemplate';

const STANDARD_ALIASES: Record<StandardContactField, string[]> = {
    name: ['name', 'full name', 'fullname', 'attendee', 'guest', 'visitor', 'contact'],
    company: ['company', 'organization', 'org', 'firm', 'business', 'affiliation'],
    position: ['position', 'title', 'job title', 'role', 'designation'],
    phone: ['phone', 'mobile', 'tel', 'telephone', 'contact no', 'contact number', 'cell'],
    email: ['email', 'e-mail', 'mail'],
    address: ['address', 'location', 'city', 'office'],
    notes: ['notes', 'purpose', 'remarks', 'comments', 'interest', 'inquiry', 'reason'],
};

function normalizeLabel(label: string): string {
    return label.trim().toLowerCase().replace(/[#:_]+/g, ' ').replace(/\s+/g, ' ');
}

/** Collect unique column headers from OCR rawColumns across entries. */
export function detectHeaders(entries: LogSheetEntry[]): string[] {
    const seen = new Set<string>();
    const headers: string[] = [];
    for (const entry of entries) {
        if (!entry.rawColumns) continue;
        for (const key of Object.keys(entry.rawColumns)) {
            const trimmed = key.trim();
            if (!trimmed) continue;
            const norm = normalizeLabel(trimmed);
            if (seen.has(norm)) continue;
            seen.add(norm);
            headers.push(trimmed);
        }
    }
    return headers;
}

/** Suggest a mapping target for a header label (heuristic). */
export function suggestTarget(sourceLabel: string): ColumnMappingTarget {
    const norm = normalizeLabel(sourceLabel);
    for (const { field } of STANDARD_FIELD_OPTIONS) {
        if (STANDARD_ALIASES[field].some(a => norm === a || norm.includes(a) || a.includes(norm))) {
            return { kind: 'standard', field };
        }
    }
    // Common non-standard event columns → custom fields by default
    return { kind: 'custom', key: sourceLabel.trim() };
}

/** Build default mappings for detected headers. */
export function suggestMappings(headers: string[]): ColumnMapping[] {
    return headers.map(sourceLabel => ({
        sourceLabel,
        target: suggestTarget(sourceLabel),
    }));
}

function lookupRawValue(
    rawColumns: Record<string, string>,
    sourceLabel: string,
): string {
    if (rawColumns[sourceLabel] != null) return String(rawColumns[sourceLabel]).trim();
    const want = normalizeLabel(sourceLabel);
    for (const [k, v] of Object.entries(rawColumns)) {
        if (normalizeLabel(k) === want) return String(v ?? '').trim();
    }
    return '';
}

function splitMulti(value: string): string[] {
    return value
        .split(/[,;/|]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

export interface MappedLogEntry extends LogSheetEntry {
    customFields: Record<string, string>;
}

/**
 * Apply column mappings to an OCR entry.
 * If the entry has no rawColumns or mappings are empty, returns the entry
 * unchanged (happy path) with empty customFields.
 */
export function applyColumnMappings(
    entry: LogSheetEntry,
    mappings: ColumnMapping[],
): MappedLogEntry {
    if (!entry.rawColumns || mappings.length === 0) {
        return { ...entry, customFields: entry.customFields ? { ...entry.customFields } : {} };
    }

    const next: MappedLogEntry = {
        ...entry,
        name: '',
        company: '',
        position: '',
        phone: [],
        email: [],
        address: '',
        notes: '',
        customFields: {},
    };

    let touchedStandard = false;

    for (const mapping of mappings) {
        const value = lookupRawValue(entry.rawColumns, mapping.sourceLabel);
        if (!value) continue;

        if (mapping.target.kind === 'ignore') continue;

        if (mapping.target.kind === 'custom') {
            const key = mapping.target.key.trim() || mapping.sourceLabel;
            if (next.customFields[key]) {
                next.customFields[key] = `${next.customFields[key]}; ${value}`;
            } else {
                next.customFields[key] = value;
            }
            continue;
        }

        touchedStandard = true;
        const field = mapping.target.field;
        if (field === 'phone' || field === 'email') {
            next[field] = [...next[field], ...splitMulti(value)];
        } else if (field === 'notes') {
            next.notes = next.notes ? `${next.notes}; ${value}` : value;
        } else {
            // Prefer first non-empty; append if already set
            const current = next[field];
            next[field] = current ? `${current} ${value}`.trim() : value;
        }
    }

    // If mappings didn't cover core fields, fall back to OCR's best-effort values
    if (!touchedStandard) {
        return {
            ...entry,
            customFields: { ...next.customFields, ...(entry.customFields || {}) },
        };
    }

    return {
        ...next,
        name: next.name || entry.name,
        company: next.company || entry.company,
        position: next.position || entry.position,
        phone: next.phone.length > 0 ? next.phone : entry.phone,
        email: next.email.length > 0 ? next.email : entry.email,
        address: next.address || entry.address,
        notes: next.notes || entry.notes,
        confidence: entry.confidence,
        rawColumns: entry.rawColumns,
        customFields: next.customFields,
    };
}

export function applyColumnMappingsToAll(
    entries: LogSheetEntry[],
    mappings: ColumnMapping[],
): MappedLogEntry[] {
    return entries.map(e => applyColumnMappings(e, mappings));
}

/** Prompt hint block for Gemini when a template is selected. */
export function buildTemplatePromptHint(mappings: ColumnMapping[]): string {
    if (mappings.length === 0) return '';
    const lines = mappings
        .filter(m => m.target.kind !== 'ignore')
        .map(m => {
            if (m.target.kind === 'standard') {
                return `- Column "${m.sourceLabel}" → contact field "${m.target.field}"`;
            }
            if (m.target.kind === 'custom') {
                return `- Column "${m.sourceLabel}" → custom field "${m.target.key}" (put in rawColumns)`;
            }
            return null;
        })
        .filter(Boolean);
    if (lines.length === 0) return '';
    return `
## Event template column hints
This sheet is expected to use these columns. Prefer these exact header names in rawColumns when present:
${lines.join('\n')}
`;
}
