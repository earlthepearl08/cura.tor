import { useCallback, useState } from 'react';
import { hasSeenScanTips, markScanTipsSeen } from '@/services/onboarding';

/**
 * First-run coach marks for Log Sheet + Multi-Card.
 * Auto-opens once until dismissed; call `reopen()` from Help/Settings.
 */
export function useScanOnboarding(autoShow = true) {
    const [open, setOpen] = useState(() => autoShow && !hasSeenScanTips());

    const dismiss = useCallback(() => {
        markScanTipsSeen();
        setOpen(false);
    }, []);

    const reopen = useCallback(() => {
        setOpen(true);
    }, []);

    return { open, dismiss, reopen };
}
