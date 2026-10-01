import { useEffect, useState } from 'react';

/**
 * Tracks browser online/offline via navigator.onLine + window events.
 * Note: onLine can be true with a captive portal / dead uplink; scan
 * flows still surface fetch failures separately.
 */
export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState(() =>
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        setIsOnline(navigator.onLine);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return isOnline;
}
