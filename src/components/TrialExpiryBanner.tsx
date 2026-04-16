import { useEffect, useState } from 'react';
import { Clock, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { consumeLastTrialExpiry } from '@/services/userService';

const ONE_DAY = 24 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
    if (ms <= 0) return 'now';
    const days = Math.floor(ms / ONE_DAY);
    if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours >= 1) return hours === 1 ? '1 hour' : `${hours} hours`;
    const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
    return `${mins} min`;
}

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TrialExpiryBanner() {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [expiredToast, setExpiredToast] = useState<string | null>(null);

    // Check once on mount for a just-downgraded session (uid-scoped to avoid leaking across users)
    useEffect(() => {
        const downgrade = consumeLastTrialExpiry(user?.uid);
        if (downgrade) setExpiredToast(downgrade.previousTier);
    }, [user?.uid]);

    // Post-expiry toast (shown once per session after downgrade)
    if (expiredToast) {
        const tierLabel = expiredToast === 'pro' ? 'Pro' : 'Pioneer';
        return (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">
                        Your {tierLabel} trial has ended. You're now on the Free plan. Your contacts are safe — you can still view, edit, and export them.
                    </p>
                </div>
                <button onClick={() => setExpiredToast(null)} className="p-1 hover:bg-white/10 rounded-lg shrink-0">
                    <X size={14} className="text-amber-400" />
                </button>
            </div>
        );
    }

    if (!user?.expiresAt || dismissed) return null;

    const remaining = user.expiresAt - Date.now();

    // Don't show the banner until within 7 days
    if (remaining > 7 * ONE_DAY) return null;

    const isUrgent = remaining <= ONE_DAY;
    const tierLabel = user.trialSourceTier === 'pro' ? 'Pro' : 'Pioneer';
    const color = isUrgent
        ? 'bg-red-500/15 border-red-500/30 text-red-400'
        : 'bg-amber-500/15 border-amber-500/30 text-amber-400';

    return (
        <div className={`mb-4 p-3 rounded-xl border flex items-start justify-between gap-3 ${color}`}>
            <div className="flex items-start gap-2 flex-1 min-w-0">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs">
                    Your {tierLabel} trial ends on <span className="font-semibold">{formatDate(user.expiresAt)}</span>
                    {' — '}
                    <span className="font-semibold">{formatRemaining(remaining)}</span> left.
                    {' '}
                    After that, you'll move to Free; your contacts stay but you'll be capped at 5 scans/month.
                </p>
            </div>
            <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/10 rounded-lg shrink-0">
                <X size={14} />
            </button>
        </div>
    );
}
