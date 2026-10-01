/**
 * User-facing scan/OCR error copy.
 * Maps API 429 / 5xx / quota / network failures to short messages that suggest
 * retry, wait, or upgrade — without leaking provider internals or raw payloads.
 */

export type ScanErrorKind =
    | 'quota'
    | 'rate_limit'
    | 'server'
    | 'network'
    | 'timeout'
    | 'auth'
    | 'unknown';

export interface FriendlyScanError {
    message: string;
    kind: ScanErrorKind;
    /** Open upgrade / plans UI when true */
    suggestUpgrade: boolean;
    /** Show retry affordance when true */
    suggestRetry: boolean;
}

/** Structured error thrown from OCR/Gemini client helpers. */
export class ScanApiError extends Error {
    status?: number;
    reason?: string;

    constructor(message: string, opts?: { status?: number; reason?: string }) {
        super(message);
        this.name = 'ScanApiError';
        this.status = opts?.status;
        this.reason = opts?.reason;
    }
}

function extractBracketReason(msg: string): string | undefined {
    const match = msg.match(/\[([a-z0-9_-]+)\]/i);
    return match?.[1];
}

function extractStatus(msg: string): number | undefined {
    const gemini = msg.match(/(?:Gemini|Cloud Vision|API)\s+error:\s*(\d{3})/i);
    if (gemini) return Number(gemini[1]);
    const http = msg.match(/\b([45]\d{2})\b/);
    if (http) return Number(http[1]);
    return undefined;
}

export function classifyScanError(err: unknown): FriendlyScanError {
    const scanErr = err instanceof ScanApiError ? err : null;
    const raw = err instanceof Error ? err.message : String(err ?? '');
    const msg = raw.toLowerCase();
    const reason = (scanErr?.reason || extractBracketReason(raw) || '').toLowerCase();
    const status = scanErr?.status ?? extractStatus(raw);

    // Tier scan limit (our API returns 429 + quota-exceeded)
    if (
        reason === 'quota-exceeded' ||
        /scan limit reached|quota.?exceeded|lifetime limit|monthly limit/i.test(raw)
    ) {
        return {
            kind: 'quota',
            suggestUpgrade: true,
            suggestRetry: false,
            message:
                "You've reached your scan limit for this plan. Upgrade to keep scanning, or wait until your limit resets.",
        };
    }

    // Abuse / provider rate limits and capacity
    if (
        status === 429 ||
        reason.startsWith('rate-limit') ||
        /rate.?limit|resource.?exhausted|high demand|overloaded|too many requests|quota/i.test(msg)
    ) {
        return {
            kind: 'rate_limit',
            suggestUpgrade: false,
            suggestRetry: true,
            message: 'Scanning is temporarily busy. Wait a moment, then try again.',
        };
    }

    // Timeouts / aborts
    if (
        (err as { name?: string })?.name === 'AbortError' ||
        /timed?\s*out|timeout|aborted|abort/i.test(msg)
    ) {
        return {
            kind: 'timeout',
            suggestUpgrade: false,
            suggestRetry: true,
            message: 'This is taking longer than usual. Please try again.',
        };
    }

    // Network
    if (/failed to fetch|networkerror|network|offline|internet/i.test(msg)) {
        return {
            kind: 'network',
            suggestUpgrade: false,
            suggestRetry: true,
            message: 'No internet connection. Check your network and try again.',
        };
    }

    // Auth
    if (status === 401 || status === 403 || /unauthorized|forbidden|not signed in|sign in/i.test(msg)) {
        return {
            kind: 'auth',
            suggestUpgrade: false,
            suggestRetry: false,
            message: 'Please sign in again to continue scanning.',
        };
    }

    // Server / upstream 5xx (and our "API key not configured" style failures)
    if (
        (status !== undefined && status >= 500) ||
        /(?:\b5\d{2}\b)|internal server|service temporarily|api key|unregistered|bad gateway|unavailable/i.test(msg)
    ) {
        return {
            kind: 'server',
            suggestUpgrade: false,
            suggestRetry: true,
            message: 'Something went wrong on our side. Please try again in a moment.',
        };
    }

    return {
        kind: 'unknown',
        suggestUpgrade: false,
        suggestRetry: true,
        message: "We couldn't process this scan. Please try again.",
    };
}

/** Convenience: message only (never returns raw API text). */
export function friendlyScanErrorMessage(err: unknown): string {
    return classifyScanError(err).message;
}
