/** OCR field correction / org glossary entry (lightweight, no ML). */

export type CorrectionField = 'company' | 'name' | 'position';

export interface FieldCorrection {
    id: string;
    field: CorrectionField;
    /** Raw OCR value as first seen */
    from: string;
    /** Normalized lookup key */
    fromNorm: string;
    /** User-corrected value */
    to: string;
    scope: 'user' | 'org';
    /** Times the user taught this mapping */
    learnCount: number;
    /** Times a later scan accepted / auto-applied it */
    hitCount: number;
    createdAt: number;
    updatedAt: number;
    /** Org glossary: who last taught it */
    createdBy?: string;
}

export interface AppliedCorrection {
    field: CorrectionField;
    from: string;
    to: string;
    correctionId: string;
    autoApplied: boolean;
}

export interface CorrectionSuggestion {
    field: CorrectionField;
    from: string;
    to: string;
    correctionId: string;
    exact: boolean;
}
