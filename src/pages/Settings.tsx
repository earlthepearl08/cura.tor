import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Check, Cloud, CloudOff, RefreshCw, Link as LinkIcon, Unplug, Clock, ShieldCheck, Smartphone, Lock, Sun, Moon, LogOut, Zap, User, Users, FileText, Shield, CreditCard, ExternalLink, X, ChevronRight } from 'lucide-react';
import { getOCREngine, setOCREngine, OCREngine } from '@/services/ocr';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { TIER_LIMITS } from '@/types/user';
import { STRIPE_PRICES, createCheckoutSession, createPortalSession, PLAN_TO_TIER, type BillingInterval } from '@/services/stripe';
import AccessCodeInput from '@/components/AccessCodeInput';

const TIER_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    free: { label: 'Free', color: 'text-slate-400', bg: 'bg-slate-500/20' },
    early_access: { label: 'Pioneer', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    pro: { label: 'Pro', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    enterprise: { label: 'Enterprise', color: 'text-sky-400', bg: 'bg-sky-500/20' },
};

const PIONEER_FEATURES = [
    'Unlimited scans',
    'Unlimited contacts',
    'vCard, CSV & Excel export',
    'Google Drive sync',
];

const PRO_FEATURES = [
    'Everything in Pioneer',
    'Multi-Card Scan',
    'Log Sheet Scan',
    'Priority support',
];

const Settings = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { theme, toggleTheme } = useTheme();
    const [ocrEngine, setOcrEngineState] = useState<OCREngine>(getOCREngine());
    const [saved, setSaved] = useState(false);
    const { isConnected, user: driveUser, isSyncing, syncProgress, lastSyncTime, connect, disconnect, syncContacts, error } = useGoogleDrive();
    const { user, firebaseUser, signOut, canUseGoogleDrive, scansRemaining, refreshUserProfile } = useAuth();

    const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeError, setUpgradeError] = useState('');
    const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'canceled'; text: string } | null>(null);

    const tierBadge = TIER_BADGES[user?.tier || 'free'];
    const limits = TIER_LIMITS[user?.tier || 'free'];

    // Handle payment callback from Stripe
    useEffect(() => {
        const payment = searchParams.get('payment');
        if (payment === 'success') {
            setPaymentMessage({ type: 'success', text: 'Payment successful! Your plan has been upgraded.' });
            refreshUserProfile();
            // Clean up URL
            searchParams.delete('payment');
            setSearchParams(searchParams, { replace: true });
        } else if (payment === 'canceled') {
            setPaymentMessage({ type: 'canceled', text: 'Payment was canceled. No changes were made.' });
            searchParams.delete('payment');
            setSearchParams(searchParams, { replace: true });
        }
    }, []);

    // Auto-dismiss payment message
    useEffect(() => {
        if (paymentMessage) {
            const timer = setTimeout(() => setPaymentMessage(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [paymentMessage]);

    const handleUpgrade = async (plan: 'pioneer' | 'pro') => {
        if (!user || !firebaseUser) return;
        setIsUpgrading(true);
        setUpgradeError('');

        try {
            const price = STRIPE_PRICES[plan][billingInterval];
            const url = await createCheckoutSession({
                firebaseUid: firebaseUser.uid,
                email: user.email,
                priceId: price.id,
                tier: PLAN_TO_TIER[plan],
            });
            window.location.href = url;
        } catch (err: any) {
            console.error('Upgrade failed:', err);
            setUpgradeError(err.message || 'Failed to start checkout. Please try again.');
            setIsUpgrading(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!user?.stripe?.customerId) return;
        setIsUpgrading(true);
        setUpgradeError('');

        try {
            const url = await createPortalSession(user.stripe.customerId);
            window.location.href = url;
        } catch (err: any) {
            console.error('Portal failed:', err);
            setUpgradeError(err.message || 'Failed to open subscription management.');
            setIsUpgrading(false);
        }
    };

    const handleConnect = async () => {
        try {
            await connect();
        } catch (err) {
            console.error('Failed to connect:', err);
        }
    };

    const handleSync = async () => {
        try {
            await syncContacts();
        } catch (err) {
            console.error('Failed to sync:', err);
        }
    };

    const handleSignOut = async () => {
        if (window.confirm('Sign out of Cura.tor?')) {
            await signOut();
            navigate('/auth');
        }
    };

    const hasStripeSubscription = !!user?.stripe?.subscriptionId;
    const showPricing = user?.tier !== 'pro' && !hasStripeSubscription;
    // Pioneer (access code) users can only upgrade to Pro
    const showPioneerCard = user?.tier === 'free';

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Settings</h1>
                <div className="w-10" />
            </div>

            {/* Payment callback message */}
            {paymentMessage && (
                <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center justify-between text-sm ${
                    paymentMessage.type === 'success'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}>
                    <span>{paymentMessage.text}</span>
                    <button onClick={() => setPaymentMessage(null)} className="p-1 hover:bg-white/10 rounded-lg">
                        <X size={14} />
                    </button>
                </div>
            )}

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Account */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Account</p>
                    <div className="card-elevated rounded-2xl p-4">
                        <div className="flex items-center gap-4 mb-4">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-12 h-12 rounded-xl object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-brand-700 flex items-center justify-center">
                                    <User className="w-6 h-6 text-brand-400" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{user?.displayName || 'User'}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${tierBadge.bg} ${tierBadge.color}`}>
                                {tierBadge.label}
                            </span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="w-full py-2.5 glass border border-brand-800 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors flex items-center justify-center gap-2"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Team — only visible for enterprise users */}
                {user?.organizationId && user?.orgRole === 'admin' && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Team</p>
                        <button
                            onClick={() => navigate('/team')}
                            className="w-full card-elevated rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                        >
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-sky-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">Team Admin</p>
                                <p className="text-xs text-slate-500">Manage members, invites, and roles</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-600" />
                        </button>
                    </div>
                )}

                {/* Plan & Usage */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Plan & Usage</p>
                    <div className="card-elevated rounded-2xl p-4 space-y-4">
                        {/* Scan Usage */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <Zap size={16} className="text-sky-400" />
                                    Scans
                                </span>
                                <span className="text-xs text-slate-500">
                                    {user?.tier === 'pro'
                                        ? 'Unlimited'
                                        : user?.tier === 'early_access'
                                            ? (user.scanUsage.lifetimeLimit !== null
                                                ? `${user.scanUsage.lifetimeCount} / ${user.scanUsage.lifetimeLimit} lifetime`
                                                : 'Unlimited')
                                            : `${user?.scanUsage.count || 0} / ${TIER_LIMITS.free.scansPerMonth} this month`
                                    }
                                </span>
                            </div>
                            {user?.tier === 'free' && (
                                <div className="w-full bg-brand-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            scansRemaining === 0 ? 'bg-red-500' : (scansRemaining !== null && scansRemaining <= 2) ? 'bg-amber-500' : 'bg-sky-500'
                                        }`}
                                        style={{
                                            width: `${Math.min(100, ((user?.scanUsage.count || 0) / (TIER_LIMITS.free.scansPerMonth || 5)) * 100)}%`
                                        }}
                                    />
                                </div>
                            )}
                            {user?.tier === 'early_access' && user.scanUsage.lifetimeLimit !== null && (
                                <div className="w-full bg-brand-700 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            scansRemaining === 0 ? 'bg-red-500' : (scansRemaining !== null && scansRemaining <= 2) ? 'bg-amber-500' : 'bg-sky-500'
                                        }`}
                                        style={{
                                            width: `${Math.min(100, (user.scanUsage.lifetimeCount / (user.scanUsage.lifetimeLimit || 30)) * 100)}%`
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Contact Storage */}
                        {user?.contactLimit !== null && user?.contactLimit !== undefined && (
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-slate-400">Contact storage</span>
                                    <span className="text-xs text-slate-500">{user.contactLimit} contacts max</span>
                                </div>
                            </div>
                        )}

                        {/* Feature list */}
                        <div className="space-y-1.5 pt-2 border-t border-brand-800">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">vCard download</span>
                                {limits.individualVCard
                                    ? <Check size={14} className="text-emerald-400" />
                                    : <Lock size={14} className="text-slate-600" />
                                }
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">CSV/Excel export</span>
                                {limits.csvExport
                                    ? <Check size={14} className="text-emerald-400" />
                                    : <Lock size={14} className="text-slate-600" />
                                }
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Google Drive sync</span>
                                {limits.googleDriveSync
                                    ? <Check size={14} className="text-emerald-400" />
                                    : <Lock size={14} className="text-slate-600" />
                                }
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Multi-Card / Log Sheet scan</span>
                                {limits.bulkScan
                                    ? <Check size={14} className="text-emerald-400" />
                                    : <Lock size={14} className="text-slate-600" />
                                }
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">QR scan</span>
                                <Check size={14} className="text-emerald-400" />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Manual entry</span>
                                <Check size={14} className="text-emerald-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subscription Management (for active Stripe subscribers) */}
                {hasStripeSubscription && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Subscription</p>
                        <div className="card-elevated rounded-2xl p-4 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/20">
                                    <CreditCard className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">
                                        {user?.tier === 'pro' ? 'Pro' : 'Pioneer'} Subscription
                                    </p>
                                    {user?.stripe?.subscriptionStatus === 'active' && user?.stripe?.currentPeriodEnd && (
                                        <p className="text-xs text-slate-500">
                                            Renews {new Date(user.stripe.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    )}
                                    {user?.stripe?.subscriptionStatus === 'canceled' && (
                                        <p className="text-xs text-amber-400">Canceled — active until period ends</p>
                                    )}
                                    {user?.stripe?.subscriptionStatus === 'past_due' && (
                                        <p className="text-xs text-red-400">Payment past due — please update your payment method</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleManageSubscription}
                                disabled={isUpgrading}
                                className="w-full py-3 glass border border-brand-700 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <ExternalLink size={14} />
                                {isUpgrading ? 'Opening...' : 'Manage Subscription'}
                            </button>
                            {upgradeError && <p className="text-xs text-red-400">{upgradeError}</p>}
                        </div>
                    </div>
                )}

                {/* Upgrade Plans (for non-Pro users without active Stripe subscription) */}
                {showPricing && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Upgrade</p>
                        <div className="card-elevated rounded-2xl p-4 space-y-4">
                            {/* Billing interval toggle */}
                            <div className="flex items-center justify-center gap-3">
                                <span className={`text-sm transition-colors ${billingInterval === 'monthly' ? 'font-medium text-slate-200' : 'text-slate-500'}`}>
                                    Monthly
                                </span>
                                <button
                                    onClick={() => setBillingInterval(b => b === 'monthly' ? 'yearly' : 'monthly')}
                                    className={`w-12 h-7 rounded-full relative transition-colors ${
                                        billingInterval === 'yearly' ? 'bg-emerald-500' : 'bg-brand-700'
                                    }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                                        billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                                </button>
                                <span className={`text-sm transition-colors ${billingInterval === 'yearly' ? 'font-medium text-slate-200' : 'text-slate-500'}`}>
                                    Yearly
                                    {billingInterval === 'yearly' && (
                                        <span className="ml-1 text-[10px] text-emerald-400 font-bold">SAVE ~17%</span>
                                    )}
                                </span>
                            </div>

                            {/* Plan cards */}
                            <div className={`grid gap-3 ${showPioneerCard ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {/* Pioneer card */}
                                {showPioneerCard && (
                                    <div className="glass border border-brand-700 rounded-xl p-4 space-y-3">
                                        <div>
                                            <h3 className="font-bold text-amber-400">Pioneer</h3>
                                            <p className="text-xl font-bold mt-1">
                                                ${billingInterval === 'monthly'
                                                    ? STRIPE_PRICES.pioneer.monthly.amount
                                                    : STRIPE_PRICES.pioneer.yearly.amount
                                                }
                                                <span className="text-xs font-normal text-slate-500">
                                                    /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            {PIONEER_FEATURES.map((f) => (
                                                <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Check size={12} className="text-amber-400 shrink-0" />
                                                    <span>{f}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => handleUpgrade('pioneer')}
                                            disabled={isUpgrading}
                                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-brand-950 rounded-xl text-sm font-bold transition-colors active:scale-95 disabled:opacity-50"
                                        >
                                            {isUpgrading ? 'Loading...' : 'Subscribe'}
                                        </button>
                                    </div>
                                )}

                                {/* Pro card */}
                                <div className={`glass border border-emerald-600/50 rounded-xl p-4 space-y-3 ${!showPioneerCard ? 'max-w-sm mx-auto w-full' : ''}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-emerald-400">Pro</h3>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">BEST VALUE</span>
                                        </div>
                                        <p className="text-xl font-bold mt-1">
                                            ${billingInterval === 'monthly'
                                                ? STRIPE_PRICES.pro.monthly.amount
                                                : STRIPE_PRICES.pro.yearly.amount
                                            }
                                            <span className="text-xs font-normal text-slate-500">
                                                /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {PRO_FEATURES.map((f) => (
                                            <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                                                <Check size={12} className="text-emerald-400 shrink-0" />
                                                <span>{f}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleUpgrade('pro')}
                                        disabled={isUpgrading}
                                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-brand-950 rounded-xl text-sm font-bold transition-colors active:scale-95 disabled:opacity-50"
                                    >
                                        {isUpgrading ? 'Loading...' : 'Subscribe'}
                                    </button>
                                </div>
                            </div>

                            {upgradeError && <p className="text-xs text-red-400 text-center">{upgradeError}</p>}
                        </div>
                    </div>
                )}

                {/* Access Code (only for free users) */}
                {user?.tier === 'free' && (
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Access Code</p>
                        <div className="card-elevated rounded-2xl p-4">
                            <p className="text-xs text-slate-500 mb-3">Have an access code? Enter it below to unlock Pioneer features.</p>
                            <AccessCodeInput />
                        </div>
                    </div>
                )}

                {/* Appearance */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Appearance</p>
                    <div className="card-elevated rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                    theme === 'dark' ? 'bg-indigo-500/20' : 'bg-amber-500/20'
                                }`}>
                                    {theme === 'dark'
                                        ? <Moon className="w-5 h-5 text-indigo-400" />
                                        : <Sun className="w-5 h-5 text-amber-500" />
                                    }
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
                                    <p className="text-xs text-slate-500">Tap to switch</p>
                                </div>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className={`w-12 h-7 rounded-full relative transition-colors ${
                                    theme === 'light' ? 'bg-amber-500' : 'bg-brand-700'
                                }`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                                    theme === 'light' ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* OCR Engine */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">OCR Engine</p>
                    <div className="card-elevated rounded-2xl p-4">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sky-500/20">
                                <Sparkles className="w-5 h-5 text-sky-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-sm">Cloud Vision + Gemini AI</p>
                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">ACTIVE</span>
                                </div>
                                <p className="text-xs text-slate-500">Google Cloud Vision for text extraction, Gemini AI for intelligent parsing</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Google Drive Sync */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Cloud Backup</p>
                    <div className="card-elevated rounded-2xl p-4">
                        {!canUseGoogleDrive() ? (
                            <div className="text-center py-4">
                                <div className="w-12 h-12 mx-auto mb-3 bg-slate-700/50 rounded-xl flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-slate-500" />
                                </div>
                                <p className="font-semibold text-sm mb-1">Pioneer Feature</p>
                                <p className="text-xs text-slate-500">Google Drive sync is available on the Pioneer plan and above</p>
                            </div>
                        ) : isConnected ? (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Cloud className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm text-emerald-400">Connected</p>
                                        {driveUser && <p className="text-xs text-slate-500">{driveUser.email}</p>}
                                    </div>
                                    {isSyncing && !syncProgress && (
                                        <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                                    )}
                                </div>

                                {/* Sync progress bar */}
                                {syncProgress && (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="text-slate-400">{syncProgress.label}</span>
                                            <span className={syncProgress.step === 'done' ? 'text-emerald-400' : 'text-brand-400'}>
                                                {syncProgress.percent}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-brand-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ease-out ${
                                                    syncProgress.step === 'done' ? 'bg-emerald-500' : 'bg-sky-500'
                                                }`}
                                                style={{ width: `${syncProgress.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {!syncProgress && lastSyncTime && (
                                    <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Last synced: {new Date(lastSyncTime).toLocaleString()}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="flex-1 py-3 text-sm glass rounded-xl disabled:opacity-50 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                                    </button>
                                    <button
                                        onClick={disconnect}
                                        disabled={isSyncing}
                                        className="py-3 px-4 text-sm bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                    >
                                        <Unplug className="w-4 h-4" />
                                    </button>
                                </div>
                                {error && (
                                    <p className="mt-3 text-xs text-red-400">{error}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center">
                                        <CloudOff className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Google Drive Backup</p>
                                        <p className="text-xs text-slate-500">Keep your contacts safe in the cloud</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4 px-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                        <span>Survives browser cache clearing</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Smartphone className="w-3 h-3 text-sky-400" />
                                        <span>Syncs across all your devices</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleConnect}
                                    className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                    Connect Google Drive
                                </button>
                                {error && (
                                    <p className="mt-3 text-xs text-red-400">{error}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Legal */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Legal</p>
                    <div className="card-elevated rounded-2xl p-4 space-y-2">
                        <button
                            onClick={() => navigate('/legal?tab=tos')}
                            className="w-full flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <FileText size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-300">Terms of Service</span>
                        </button>
                        <button
                            onClick={() => navigate('/legal?tab=privacy')}
                            className="w-full flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <Shield size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-300">Privacy Policy</span>
                        </button>
                    </div>
                </div>

                {/* About */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">About</p>
                    <div className="card-elevated rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-500">Cura.tor v1.0 Beta</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
