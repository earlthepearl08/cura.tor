import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type OfflineStatusBannerProps = {
    /** Where the banner is shown — tweaks the supporting sentence. */
    context?: 'home' | 'contacts';
    className?: string;
};

/**
 * Honest offline status: saved contacts remain usable; new OCR scans need network.
 * Hidden while online. Does not claim fake offline scanning.
 */
const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
    context = 'home',
    className = '',
}) => {
    const isOnline = useOnlineStatus();
    if (isOnline) return null;

    const detail =
        context === 'contacts'
            ? 'You can still view, edit, and export contacts saved on this device. New scans need a network connection.'
            : 'Saved contacts still work for view, edit, and export. Scanning a new card or log sheet needs a network connection.';

    return (
        <div
            className={`w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 ${className}`}
            role="status"
            aria-live="polite"
        >
            <WifiOff size={16} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-300">You're offline</p>
                <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">{detail}</p>
            </div>
        </div>
    );
};

export default OfflineStatusBanner;
