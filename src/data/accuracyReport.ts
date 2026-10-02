/**
 * Published accuracy report snapshot for the public /accuracy page.
 *
 * Source: synthetic golden-set mock eval (PR #36 — `npm run eval:accuracy`).
 * This is NOT live Gemini F1 on real photos. Do not present these numbers as
 * production OCR accuracy until Earl drops real samples and a live report is published.
 *
 * Update this file after a real live eval; keep `status` honest.
 */

export type AccuracyReportStatus = 'synthetic-demo' | 'live-measured';

export interface PrimaryFieldScore {
    field: 'name' | 'company' | 'phone' | 'email';
    /** 0–1 */
    score: number;
    label: string;
}

export interface AccuracyReport {
    status: AccuracyReportStatus;
    /** Human banner — always show when synthetic-demo */
    statusLabel: string;
    statusDetail: string;
    generatedAt: string;
    source: {
        harness: string;
        command: string;
        mode: 'mock' | 'live';
        prNote: string;
    };
    coverage: {
        cards: number;
        targetCards: number;
        logSheets: number;
        targetSheets: number;
    };
    primaryFields: PrimaryFieldScore[];
    cardsPrimaryAccuracy: number;
    logSheetsPrimaryAccuracy: number;
    /** Explicit non-claim for live Gemini */
    liveGeminiF1: {
        published: false;
        label: string;
        detail: string;
    };
}

/** Snapshot from synthetic mock eval report (2026-10-01). */
export const PUBLISHED_ACCURACY_REPORT: AccuracyReport = {
    status: 'synthetic-demo',
    statusLabel: 'Synthetic / demo baseline',
    statusDetail:
        'Scores below come from the internal synthetic golden set (expected JSON vs fixture mocks). They verify the scoring harness and fixture coverage — they are not measured Gemini Vision F1 on real card or log-sheet photos.',
    generatedAt: '2026-10-01T09:04:15.378Z',
    source: {
        harness: 'eval/accuracy/',
        command: 'npm run eval:accuracy',
        mode: 'mock',
        prNote: 'Golden-set fixtures from PR #36; gallery UI from PR #24 stack.',
    },
    coverage: {
        cards: 30,
        targetCards: 30,
        logSheets: 10,
        targetSheets: 10,
    },
    primaryFields: [
        { field: 'name', score: 1, label: 'Name' },
        { field: 'company', score: 1, label: 'Company' },
        { field: 'phone', score: 1, label: 'Phone' },
        { field: 'email', score: 1, label: 'Email' },
    ],
    cardsPrimaryAccuracy: 1,
    logSheetsPrimaryAccuracy: 1,
    liveGeminiF1: {
        published: false,
        label: 'Live Gemini F1 — not published yet',
        detail:
            'No live field F1 is shown here on purpose. After real PH samples are added (see eval/accuracy/HOWTO-REAL-SAMPLES.md), replace this snapshot with a live eval report and set status to live-measured.',
    },
};

export function formatPct(score: number): string {
    return `${Math.round(score * 1000) / 10}%`;
}
