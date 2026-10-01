import { FieldCorrection, CorrectionField, AppliedCorrection, CorrectionSuggestion } from '@/types/correction';
import { normalizeText, textSimilarity } from '@/services/duplicateDetection';

export const CORRECTION_FIELDS: CorrectionField[] = ['company', 'name', 'position'];

const AUTO_APPLY_MIN_LEARNS = 2;
const FUZZY_MATCH_THRESHOLD = 92;
const MAX_CORRECTIONS = 300;

/** Minimal storage surface used by correction memory (personal + team). */
export interface CorrectionStorage {
    getAllCorrections(): Promise<FieldCorrection[]>;
    saveCorrection(correction: FieldCorrection): Promise<void>;
    deleteCorrection(id: string): Promise<void>;
}

export function correctionId(field: CorrectionField, fromNorm: string): string {
    // Stable id for upsert — avoids duplicates for the same raw→field pair
    return `${field}:${fromNorm}`;
}

export function isMeaningfulCorrection(from: string, to: string): boolean {
    const a = normalizeText(from);
    const b = normalizeText(to);
    if (!a || !b || a === b) return false;
    if (a.length < 2) return false;
    return true;
}

/**
 * Learn a single field mapping (OCR raw → user correction).
 * Upserts by (field, fromNorm); bumps learnCount.
 */
export async function learnFieldCorrection(
    storage: CorrectionStorage,
    field: CorrectionField,
    from: string,
    to: string,
    opts: { scope: 'user' | 'org'; createdBy?: string }
): Promise<FieldCorrection | null> {
    if (!isMeaningfulCorrection(from, to)) return null;

    const fromNorm = normalizeText(from);
    const id = correctionId(field, fromNorm);
    const existing = (await storage.getAllCorrections()).find(c => c.id === id);
    const now = Date.now();

    const next: FieldCorrection = existing
        ? {
            ...existing,
            from: from.trim(),
            fromNorm,
            to: to.trim(),
            learnCount: existing.learnCount + 1,
            updatedAt: now,
            createdBy: opts.createdBy ?? existing.createdBy,
            scope: opts.scope,
        }
        : {
            id,
            field,
            from: from.trim(),
            fromNorm,
            to: to.trim(),
            scope: opts.scope,
            learnCount: 1,
            hitCount: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: opts.createdBy,
        };

    await storage.saveCorrection(next);
    await pruneIfNeeded(storage);
    return next;
}

/** Diff original OCR fields vs user values and learn each change. */
export async function learnFromFieldDiffs(
    storage: CorrectionStorage,
    original: Partial<Record<CorrectionField, string>>,
    corrected: Partial<Record<CorrectionField, string>>,
    opts: { scope: 'user' | 'org'; createdBy?: string }
): Promise<number> {
    let learned = 0;
    for (const field of CORRECTION_FIELDS) {
        const from = (original[field] ?? '').trim();
        const to = (corrected[field] ?? '').trim();
        if (!from || !to) continue;
        const result = await learnFieldCorrection(storage, field, from, to, opts);
        if (result) learned++;
    }
    return learned;
}

export async function recordCorrectionHit(
    storage: CorrectionStorage,
    correctionIdValue: string
): Promise<void> {
    const all = await storage.getAllCorrections();
    const existing = all.find(c => c.id === correctionIdValue);
    if (!existing) return;
    await storage.saveCorrection({
        ...existing,
        hitCount: existing.hitCount + 1,
        updatedAt: Date.now(),
    });
}

function findBestMatch(
    corrections: FieldCorrection[],
    field: CorrectionField,
    value: string
): { correction: FieldCorrection; exact: boolean } | null {
    const norm = normalizeText(value);
    if (!norm) return null;

    const fieldCorrections = corrections.filter(c => c.field === field);
    const exact = fieldCorrections.find(c => c.fromNorm === norm);
    if (exact && normalizeText(exact.to) !== norm) {
        return { correction: exact, exact: true };
    }

    let best: FieldCorrection | null = null;
    let bestScore = 0;
    for (const c of fieldCorrections) {
        if (normalizeText(c.to) === norm) continue; // already at target
        const score = textSimilarity(value, c.from);
        if (score >= FUZZY_MATCH_THRESHOLD && score > bestScore) {
            best = c;
            bestScore = score;
        }
    }
    return best ? { correction: best, exact: false } : null;
}

export interface ApplyResult<T> {
    record: T;
    applied: AppliedCorrection[];
    suggestions: CorrectionSuggestion[];
}

/**
 * Apply glossary to a single OCR record.
 * Exact matches with learnCount >= 2 are auto-applied; others become suggestions.
 */
type CorrectableFields = {
    name?: string;
    company?: string;
    position?: string;
};

export function applyCorrectionsToRecord<T extends CorrectableFields>(
    record: T,
    corrections: FieldCorrection[],
    options: { autoApply?: boolean } = {}
): ApplyResult<T> {
    const autoApply = options.autoApply !== false;
    const next = { ...record };
    const applied: AppliedCorrection[] = [];
    const suggestions: CorrectionSuggestion[] = [];

    for (const field of CORRECTION_FIELDS) {
        const raw = next[field];
        if (typeof raw !== 'string' || !raw.trim()) continue;

        const match = findBestMatch(corrections, field, raw);
        if (!match) continue;

        const { correction, exact } = match;
        const shouldAuto = autoApply && exact && correction.learnCount >= AUTO_APPLY_MIN_LEARNS;

        if (shouldAuto) {
            next[field] = correction.to;
            applied.push({
                field,
                from: raw,
                to: correction.to,
                correctionId: correction.id,
                autoApplied: true,
            });
        } else {
            suggestions.push({
                field,
                from: raw,
                to: correction.to,
                correctionId: correction.id,
                exact,
            });
        }
    }

    return { record: next, applied, suggestions };
}

export function applyCorrectionsToRecords<T extends CorrectableFields>(
    records: T[],
    corrections: FieldCorrection[]
): { records: T[]; applied: AppliedCorrection[][]; suggestions: CorrectionSuggestion[][] } {
    const applied: AppliedCorrection[][] = [];
    const suggestions: CorrectionSuggestion[][] = [];
    const out = records.map((r, i) => {
        const result = applyCorrectionsToRecord(r, corrections);
        applied[i] = result.applied;
        suggestions[i] = result.suggestions;
        return result.record;
    });
    return { records: out, applied, suggestions };
}

export type OcrFieldSnapshot = Partial<Record<CorrectionField, string>>;

/**
 * Snapshot OCR fields, apply glossary, and bump hit counts for auto-applies.
 * Used by Log Sheet / Multi-Card after parse.
 */
export async function enrichEntriesWithGlossary<T extends CorrectableFields>(
    storage: CorrectionStorage,
    entries: T[]
): Promise<{
    entries: T[];
    snapshots: OcrFieldSnapshot[];
    appliedFlat: AppliedCorrection[];
}> {
    const snapshots: OcrFieldSnapshot[] = entries.map(e => ({
        name: e.name || '',
        company: e.company || '',
        position: e.position || '',
    }));

    let corrections: FieldCorrection[] = [];
    try {
        corrections = await storage.getAllCorrections();
    } catch {
        return { entries, snapshots, appliedFlat: [] };
    }

    if (corrections.length === 0) {
        return { entries, snapshots, appliedFlat: [] };
    }

    const { records, applied } = applyCorrectionsToRecords(entries, corrections);
    const appliedFlat = applied.flat();
    for (const a of appliedFlat) {
        try {
            await recordCorrectionHit(storage, a.correctionId);
        } catch { /* non-blocking */ }
    }
    return { entries: records, snapshots, appliedFlat };
}

async function pruneIfNeeded(storage: CorrectionStorage): Promise<void> {
    const all = await storage.getAllCorrections();
    if (all.length <= MAX_CORRECTIONS) return;

    const sorted = [...all].sort((a, b) => {
        const scoreA = a.learnCount * 10 + a.hitCount;
        const scoreB = b.learnCount * 10 + b.hitCount;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.updatedAt - b.updatedAt;
    });

    const toRemove = sorted.slice(0, all.length - MAX_CORRECTIONS);
    for (const c of toRemove) {
        await storage.deleteCorrection(c.id);
    }
}
