/** Standard contact fields used for log-sheet column mapping. */
export type LogSheetFieldKey =
    | 'name'
    | 'company'
    | 'position'
    | 'phone'
    | 'email'
    | 'address'
    | 'notes';

export const LOG_SHEET_FIELD_KEYS: LogSheetFieldKey[] = [
    'name', 'company', 'position', 'phone', 'email', 'address', 'notes',
];

export const LOG_SHEET_FIELD_LABELS: Record<LogSheetFieldKey, string> = {
    name: 'Name',
    company: 'Company',
    position: 'Position',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    notes: 'Notes / Purpose',
};

/** Maps each standard field → detected header label (empty string = unused). */
export type LogSheetColumnMapping = Partial<Record<LogSheetFieldKey, string>>;

export interface LogSheetParseMeta {
    detectedHeaders: string[];
    suggestedMapping: LogSheetColumnMapping;
    headersAmbiguous: boolean;
    ambiguityReasons: string[];
}

export interface LogSheetParseOptions {
    /** Confirmed mapping from a prior sheet in this batch — guides Gemini. */
    columnMapping?: LogSheetColumnMapping;
}
