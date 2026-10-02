/** Event log-sheet templates: map sheet columns → contact / custom fields. */

export type StandardContactField =
    | 'name'
    | 'company'
    | 'position'
    | 'phone'
    | 'email'
    | 'address'
    | 'notes';

export type ColumnMappingTarget =
    | { kind: 'standard'; field: StandardContactField }
    | { kind: 'custom'; key: string }
    | { kind: 'ignore' };

export interface ColumnMapping {
    /** Header text as it appears on the sheet (or as OCR returned it). */
    sourceLabel: string;
    target: ColumnMappingTarget;
}

export interface EventTemplate {
    id: string;
    name: string;
    mappings: ColumnMapping[];
    createdAt: number;
    updatedAt: number;
}

export const STANDARD_FIELD_OPTIONS: { field: StandardContactField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'company', label: 'Company' },
    { field: 'position', label: 'Position / Title' },
    { field: 'phone', label: 'Phone' },
    { field: 'email', label: 'Email' },
    { field: 'address', label: 'Address' },
    { field: 'notes', label: 'Notes' },
];
