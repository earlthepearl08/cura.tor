import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { storage } from '@/services/storage';

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_CONTACTS = 1;

function dismissKey(uid: string) {
    return `driveBackupPromptDismissed:${uid}`;
}

function isSnoozed(uid: string): boolean {
    try {
        const raw = localStorage.getItem(dismissKey(uid));
        if (!raw) return false;
        const until = parseInt(raw, 10);
        if (Number.isNaN(until)) return false;
        return Date.now() < until;
    } catch {
        return false;
    }
}

function snooze(uid: string) {
    try {
        localStorage.setItem(dismissKey(uid), String(Date.now() + SNOOZE_MS));
    } catch {
        // ignore quota / private mode
    }
}

type DriveBackupPromptProps = {
    /** Slightly denser layout for Settings */
    variant?: 'home' | 'settings';
};

/**
 * Calm, dismissible reminder that personal contacts live on-device until Drive sync is on.
 * Shown only for Pioneer+ users with personal contacts and Drive disconnected.
 * Dismiss snoozes for 14 days (uid-scoped).
 */
export default function DriveBackupPrompt({ variant = 'home' }: DriveBackupPromptProps) {
    const navigate = useNavigate();
    const { user, canUseGoogleDrive } = useAuth();
    const { mode } = useWorkspace();
    const { isConnected } = useGoogleDrive();
    const [contactCount, setContactCount] = useState(0);
    const [hidden, setHidden] = useState(false);

    const uid = user?.uid;

    useEffect(() => {
        if (!uid || !canUseGoogleDrive() || isConnected || mode !== 'personal') {
            setContactCount(0);
            return;
        }
        let cancelled = false;
        storage.getAllContacts().then((contacts) => {
            if (!cancelled) setContactCount(contacts.length);
        }).catch(() => {
            if (!cancelled) setContactCount(0);
        });
        return () => { cancelled = true; };
    }, [uid, canUseGoogleDrive, isConnected, mode]);

    if (!uid || hidden || !canUseGoogleDrive() || isConnected || mode !== 'personal') {
        return null;
    }
    if (contactCount < MIN_CONTACTS) return null;
    if (isSnoozed(uid)) return null;

    const handleDismiss = () => {
        snooze(uid);
        setHidden(true);
    };

    const goEnable = () => {
        navigate('/settings');
    };

    return (
        <div
            className={`rounded-xl border border-sky-500/20 bg-sky-500/10 flex items-start gap-3 ${
                variant === 'settings' ? 'p-3 mb-0' : 'p-3 mb-4'
            }`}
            role="status"
        >
            <CloudOff className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 leading-relaxed">
                    Your {contactCount === 1 ? 'contact is' : `${contactCount} contacts are`} saved on this device.
                    {' '}A browser clear or device wipe can remove them — Google Drive backup keeps a copy in your App Data folder.
                </p>
                {variant === 'home' && (
                    <button
                        type="button"
                        onClick={goEnable}
                        className="mt-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        Enable backup in Settings
                    </button>
                )}
                {variant === 'settings' && (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                        Connect below when you are ready — no rush.
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={handleDismiss}
                className="p-1 hover:bg-white/10 rounded-lg shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Dismiss backup reminder"
            >
                <X size={14} />
            </button>
        </div>
    );
}
