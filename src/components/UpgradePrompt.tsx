import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Ticket, Sparkles, Camera, PenLine, QrCode, Users, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TIER_LIMITS } from '@/types/user';
import { getNextScanReset } from '@/services/userService';

export type UpgradeFeature = 'scan' | 'export' | 'drive' | 'storage' | 'bulk-scan';

interface UpgradePromptProps {
    feature: UpgradeFeature;
    onDismiss: () => void;
    scansUsed?: number;
    scansLimit?: number;
    contactCount?: number;
    contactLimit?: number;
}

type AltAction = {
    label: string;
    path: string;
    icon: React.ReactNode;
};

function getFeatureMessage(
    feature: UpgradeFeature,
    tier: string,
    opts: { scansLimit?: number; contactLimit?: number; resetLabel?: string | null }
): { title: string; message: string; upgradeTier: 'pioneer' | 'pro' } {
    const freeScans = TIER_LIMITS.free.scansPerMonth ?? 5;
    const freeContacts = TIER_LIMITS.free.contactStorage ?? 25;
    const pioneerContacts = TIER_LIMITS.early_access.contactStorage ?? 50;

    if (feature === 'scan') {
        if (tier === 'early_access') {
            const cap = opts.scansLimit ?? 'your';
            return {
                title: 'Trial scans used up',
                message: `You've used all ${cap} Pioneer trial scans. Upgrade to Pro for unlimited scans plus Multi-Card and Log Sheet.`,
                upgradeTier: 'pro',
            };
        }
        const resetHint = opts.resetLabel
            ? ` Free scans reset on ${opts.resetLabel}.`
            : ' Free scans reset monthly.';
        return {
            title: 'Monthly scan limit reached',
            message: `You've used all ${freeScans} free card scans this month.${resetHint} Upgrade to Pioneer for unlimited scans, exports, and Drive sync — or keep working with QR scan and manual entry (they don't use scan credits).`,
            upgradeTier: 'pioneer',
        };
    }

    if (feature === 'bulk-scan') {
        return {
            title: 'Pro feature',
            message: 'Multi-Card and Log Sheet scanning are on the Pro plan. You can still scan single cards, upload images, scan QR codes, or add contacts manually on your current plan.',
            upgradeTier: 'pro',
        };
    }

    if (feature === 'export') {
        return {
            title: 'Export locked',
            message: 'vCard, CSV, Excel, CRM CSV, and Google Sheets unlock on Pioneer and above. Your contacts stay safe — you can still view, edit, call, and email them anytime.',
            upgradeTier: 'pioneer',
        };
    }

    if (feature === 'drive') {
        return {
            title: 'Google Drive locked',
            message: 'Cloud backup with Google Drive is available on Pioneer and above. Until then, contacts stay in local storage on this device.',
            upgradeTier: 'pioneer',
        };
    }

    // storage
    if (tier === 'early_access') {
        return {
            title: 'Contact limit reached',
            message: `Pioneer includes up to ${pioneerContacts} contacts. Upgrade to Pro for unlimited storage, or free space by editing/removing contacts you no longer need.`,
            upgradeTier: 'pro',
        };
    }
    return {
        title: 'Contact limit reached',
        message: `Free includes up to ${freeContacts} contacts. Upgrade to Pioneer for ${pioneerContacts} contacts (Pro is unlimited), or manage existing contacts to free a slot.`,
        upgradeTier: 'pioneer',
    };
}

function getAltActions(feature: UpgradeFeature, tier: string): AltAction[] {
    switch (feature) {
        case 'scan':
            return [
                { label: 'Scan QR (free)', path: '/qr-scan', icon: <QrCode size={14} /> },
                { label: 'Add manually', path: '/manual', icon: <PenLine size={14} /> },
                { label: 'View contacts', path: '/contacts', icon: <Users size={14} /> },
            ];
        case 'bulk-scan':
            return [
                { label: 'Scan one card', path: '/scan', icon: <Camera size={14} /> },
                { label: 'Upload images', path: '/upload', icon: <FolderOpen size={14} /> },
                { label: 'Add manually', path: '/manual', icon: <PenLine size={14} /> },
            ];
        case 'export':
            return [
                { label: 'View contacts', path: '/contacts', icon: <Users size={14} /> },
                { label: 'Scan another card', path: '/scan', icon: <Camera size={14} /> },
            ];
        case 'drive':
            return [
                { label: 'Continue locally', path: '/contacts', icon: <Users size={14} /> },
            ];
        case 'storage':
            return [
                { label: 'Manage contacts', path: '/contacts', icon: <Users size={14} /> },
                ...(tier === 'free'
                    ? [{ label: 'Scan QR (no credit)', path: '/qr-scan', icon: <QrCode size={14} /> }]
                    : []),
            ];
        default:
            return [{ label: 'Back home', path: '/', icon: <Camera size={14} /> }];
    }
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({
    feature,
    onDismiss,
    scansUsed,
    scansLimit,
    contactCount,
    contactLimit,
}) => {
    const navigate = useNavigate();
    const { user, redeemAccessCode } = useAuth();
    const [showCodeInput, setShowCodeInput] = useState(false);
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    const tier = user?.tier || 'free';
    const resetDate = user ? getNextScanReset(user) : null;
    const resetLabel = resetDate
        ? resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    const { title, message, upgradeTier } = getFeatureMessage(feature, tier, {
        scansLimit,
        contactLimit,
        resetLabel,
    });
    const altActions = getAltActions(feature, tier);
    const showUpgradeCta = tier !== 'pro' && tier !== 'enterprise';

    const handleRedeem = async () => {
        if (!code.trim()) return;
        setIsRedeeming(true);
        setCodeError('');
        const result = await redeemAccessCode(code.trim());
        setIsRedeeming(false);
        if (result.success) {
            onDismiss();
        } else {
            setCodeError(result.message);
        }
    };

    const goUpgrade = () => {
        onDismiss();
        navigate('/settings?upgrade=' + upgradeTier);
    };

    const goAlt = (path: string) => {
        onDismiss();
        navigate(path);
    };

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-labelledby="upgrade-prompt-title">
            <div className="bg-brand-900 rounded-2xl p-6 max-w-sm w-full border border-brand-800 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-full bg-amber-500/20">
                        <Lock className="text-amber-400" size={24} />
                    </div>
                    <h3 id="upgrade-prompt-title" className="text-lg font-bold">{title}</h3>
                </div>

                <p className="text-brand-400 text-sm mb-4">{message}</p>

                {feature === 'scan' && scansUsed !== undefined && scansLimit !== undefined && (
                    <div className="p-3 rounded-xl bg-brand-800/50 mb-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Scans used</span>
                            <span className="font-medium">{scansUsed} / {scansLimit}</span>
                        </div>
                        <div className="w-full bg-brand-700 rounded-full h-2">
                            <div
                                className="bg-amber-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (scansUsed / Math.max(1, scansLimit)) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {feature === 'storage' && contactCount !== undefined && contactLimit !== undefined && (
                    <div className="p-3 rounded-xl bg-brand-800/50 mb-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Contacts</span>
                            <span className="font-medium">{contactCount} / {contactLimit}</span>
                        </div>
                        <div className="w-full bg-brand-700 rounded-full h-2">
                            <div
                                className="bg-amber-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (contactCount / Math.max(1, contactLimit)) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {showUpgradeCta && (
                    <button
                        onClick={goUpgrade}
                        className="w-full mb-3 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        Upgrade to {upgradeTier === 'pro' ? 'Pro' : 'Pioneer'}
                    </button>
                )}

                {tier === 'free' && !showCodeInput && (
                    <button
                        onClick={() => setShowCodeInput(true)}
                        className="w-full mb-3 py-2.5 glass border border-brand-700 rounded-xl text-xs font-medium text-brand-400 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                    >
                        <Ticket size={14} />
                        Have an access code?
                    </button>
                )}

                {showCodeInput && (
                    <div className="mb-3 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="Enter code"
                                className="flex-1 glass border border-brand-700 rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-brand-500 uppercase"
                                onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                            />
                            <button
                                onClick={handleRedeem}
                                disabled={isRedeeming || !code.trim()}
                                className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                            >
                                {isRedeeming ? '...' : 'Apply'}
                            </button>
                        </div>
                        {codeError && <p className="text-xs text-red-400">{codeError}</p>}
                    </div>
                )}

                {/* Soft next steps — never a pure dead-end */}
                <div className="mb-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-0.5">
                        Or keep going free
                    </p>
                    <div className="flex flex-col gap-1.5">
                        {altActions.map((action) => (
                            <button
                                key={action.path + action.label}
                                onClick={() => goAlt(action.path)}
                                className="w-full py-2.5 glass border border-brand-800 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                            >
                                {action.icon}
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={onDismiss}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-300 transition-colors text-xs"
                >
                    Not now
                </button>
            </div>
        </div>
    );
};

export default UpgradePrompt;
