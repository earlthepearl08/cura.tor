/** First-run scan tips for Log Sheet + Multi-Card (differentiators). */

export const SCAN_TIPS_SEEN_KEY = 'onboarding_scan_tips_seen';

export function hasSeenScanTips(): boolean {
    try {
        return localStorage.getItem(SCAN_TIPS_SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

export function markScanTipsSeen(): void {
    try {
        localStorage.setItem(SCAN_TIPS_SEEN_KEY, '1');
    } catch {
        /* private mode / quota — ignore */
    }
}

export function clearScanTipsSeen(): void {
    try {
        localStorage.removeItem(SCAN_TIPS_SEEN_KEY);
    } catch {
        /* ignore */
    }
}
