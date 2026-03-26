import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, X, CreditCard, Ticket, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UpgradePromptProps {
    feature: 'scan' | 'export' | 'drive' | 'storage' | 'bulk-scan';
    onDismiss: () => void;
    scansUsed?: number;
    scansLimit?: number;
    contactCount?: number;
    contactLimit?: number;
}

function getFeatureMessage(feature: string, tier: string): { title: string; message: string; upgradeTier: 'pioneer' | 'pro' } {
    if (feature === 'scan') {
        if (tier === 'early_access') {
            return {
                title: 'All Scans Used',
                message: 'You\'ve used all of your Pioneer scans. Upgrade to Pro for unlimited scans and bulk scanning.',
                upgradeTier: 'pro',
            };
        }
        return {
            title: 'Scan Limit Reached',
            message: 'You\'ve used all 5 free scans this month. Upgrade to Pioneer for unlimited scans, or wait for your monthly reset.',
            upgradeTier: 'pioneer',
        };
    }
    if (feature === 'bulk-scan') {
        return {
            title: 'Pro Feature',
            message: 'Multi-Card Scan and Log Sheet Scan are exclusive to the Pro plan.',
            upgradeTier: 'pro',
        };
    }
    if (feature === 'export') {
        return {
            title: 'Export Locked',
            message: 'Export features (vCard, CSV, Excel) are available on the Pioneer plan and above.',
            upgradeTier: 'pioneer',
        };
    }
    if (feature === 'drive') {
        return {
            title: 'Google Drive Locked',
            message: 'Google Drive sync is available on the Pioneer plan and above.',
            upgradeTier: 'pioneer',
        };
    }
    // storage
    if (tier === 'early_access') {
        return {
            title: 'Storage Limit Reached',
            message: 'You\'ve reached your Pioneer limit of 50 contacts. Upgrade to Pro for unlimited storage.',
            upgradeTier: 'pro',
        };
    }
    return {
        title: 'Storage Limit Reached',
        message: 'You\'ve reached the free limit of 25 contacts. Upgrade to unlock more storage.',
        upgradeTier: 'pioneer',
    };
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

    const { title, message, upgradeTier } = getFeatureMessage(feature, user?.tier || 'free');

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

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6">
            <div className="bg-brand-900 rounded-2xl p-6 max-w-sm w-full border border-brand-800 shadow-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-full bg-amber-500/20">
                        <Lock className="text-amber-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold">{title}</h3>
                </div>

                {/* Message */}
                <p className="text-brand-400 text-sm mb-4">{message}</p>

                {/* Usage info */}
                {feature === 'scan' && scansUsed !== undefined && scansLimit !== undefined && (
                    <div className="p-3 rounded-xl bg-brand-800/50 mb-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Scans used</span>
                            <span className="font-medium">{scansUsed} / {scansLimit}</span>
                        </div>
                        <div className="w-full bg-brand-700 rounded-full h-2">
                            <div
                                className="bg-amber-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (scansUsed / scansLimit) * 100)}%` }}
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
                                style={{ width: `${Math.min(100, (contactCount / contactLimit) * 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Upgrade button */}
                {user?.tier !== 'pro' && (
                    <button
                        onClick={() => { onDismiss(); navigate('/settings?upgrade=' + upgradeTier); }}
                        className="w-full mb-3 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        Upgrade to {upgradeTier === 'pro' ? 'Pro' : 'Pioneer'}
                    </button>
                )}

                {/* Access code section (free users only) */}
                {user?.tier === 'free' && !showCodeInput && (
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

                {/* Dismiss */}
                <button
                    onClick={onDismiss}
                    className="w-full py-3 glass rounded-xl font-medium hover:bg-white/5 transition-colors text-sm"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default UpgradePrompt;
