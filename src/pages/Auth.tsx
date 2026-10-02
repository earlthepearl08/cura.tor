import React, { useState, useMemo, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
    Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle,
    ScanLine, Users as UsersIcon, FileDown, WifiOff, ChevronDown, ShieldCheck,
    ArrowLeft, CheckCircle2, Link2,
} from 'lucide-react';
import { useAuth, MAGIC_LINK_EMAIL_KEY } from '@/contexts/AuthContext';

function detectInAppBrowser(): string | null {
    const ua = navigator.userAgent || '';
    if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/\bLine\//i.test(ua)) return 'LINE';
    if (/Twitter|TwitterAndroid/i.test(ua)) return 'Twitter';
    if (/LinkedIn/i.test(ua)) return 'LinkedIn';
    if (/\[FB/i.test(ua) || /Messenger/i.test(ua)) return 'Messenger';
    if (/Snapchat/i.test(ua)) return 'Snapchat';
    if (/TikTok/i.test(ua)) return 'TikTok';
    return null;
}

const BENEFITS: { icon: React.ComponentType<{ className?: string }>; label: string; detail: string }[] = [
    { icon: ScanLine, label: 'Scan in seconds', detail: 'AI reads even stylized or crumpled cards (needs a connection)' },
    { icon: UsersIcon, label: 'Never lose a lead', detail: 'Saved on your device, optional Google Drive sync' },
    { icon: FileDown, label: 'Export anywhere', detail: 'vCard, CSV, or Excel — no retyping' },
    { icon: WifiOff, label: 'Contacts work offline', detail: 'View, edit, and export saved contacts without signal — new scans need a connection' },
];

type AuthMode = 'signin' | 'signup' | 'reset';

const Auth: React.FC = () => {
    const {
        user,
        isLoading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        sendMagicLink,
        isMagicLinkSignIn,
        completeMagicLinkSignIn,
    } = useAuth();
    const inAppBrowser = useMemo(() => detectInAppBrowser(), []);
    const [mode, setMode] = useState<AuthMode>('signin');
    const [showEmailForm, setShowEmailForm] = useState(false);
    /** Password form vs passwordless magic link (email section only). */
    const [emailMethod, setEmailMethod] = useState<'password' | 'magic'>('magic');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [completingMagicLink, setCompletingMagicLink] = useState(false);
    const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

    // Complete magic-link sign-in when user returns from email
    useEffect(() => {
        if (!isMagicLinkSignIn()) return;

        setShowEmailForm(true);
        setEmailMethod('magic');
        setCompletingMagicLink(true);
        setError('');
        setInfo('');

        const finish = async () => {
            try {
                await completeMagicLinkSignIn();
                // onAuthStateChanged will set user → Navigate home
            } catch (err: any) {
                if (err.code === 'auth/missing-email') {
                    setNeedsEmailConfirm(true);
                    setInfo('Confirm the email you used for the link to finish signing in.');
                } else if (err.code === 'auth/invalid-action-code') {
                    setError('This sign-in link is invalid or has expired. Request a new one.');
                } else {
                    setError(err.message || 'Could not complete sign-in from email link');
                }
            } finally {
                setCompletingMagicLink(false);
            }
        };

        void finish();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Prefill email from magic-link storage when opening the form
    useEffect(() => {
        if (!showEmailForm) return;
        const stored = window.localStorage.getItem(MAGIC_LINK_EMAIL_KEY);
        if (stored && !email) setEmail(stored);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showEmailForm]);

    // Already signed in — redirect to home
    if (!isLoading && user && !completingMagicLink) {
        return <Navigate to="/app" replace />;
    }

    const mapAuthError = (err: any): string => {
        const code = err?.code || '';
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            return mode === 'reset'
                ? 'If an account exists for that email, a reset link will be sent.'
                : 'Invalid email or password';
        }
        if (code === 'auth/email-already-in-use') {
            return 'An account with this email already exists';
        }
        if (code === 'auth/weak-password') {
            return 'Password must be at least 6 characters';
        }
        if (code === 'auth/invalid-email') {
            return 'Please enter a valid email address';
        }
        if (code === 'auth/too-many-requests') {
            return 'Too many attempts. Please try again later.';
        }
        if (code === 'auth/invalid-action-code') {
            return 'This sign-in link is invalid or has expired. Request a new one.';
        }
        return err?.message || 'Something went wrong';
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setIsSubmitting(true);

        try {
            if (mode === 'reset') {
                if (!email.trim()) {
                    setError('Please enter your email address');
                    setIsSubmitting(false);
                    return;
                }
                await resetPassword(email);
                setInfo('Password reset email sent. Check your inbox for a link to set a new password.');
                return;
            }

            if (emailMethod === 'magic' || needsEmailConfirm) {
                if (!email.trim()) {
                    setError('Please enter your email address');
                    setIsSubmitting(false);
                    return;
                }
                if (needsEmailConfirm && isMagicLinkSignIn()) {
                    setCompletingMagicLink(true);
                    await completeMagicLinkSignIn(email);
                    setNeedsEmailConfirm(false);
                    return;
                }
                await sendMagicLink(email);
                setMagicLinkSent(true);
                setInfo(`Magic link sent to ${email.trim()}. Open it on this device to sign in.`);
                return;
            }

            if (mode === 'signup') {
                if (!displayName.trim()) {
                    setError('Please enter your name');
                    setIsSubmitting(false);
                    return;
                }
                await signUpWithEmail(email, password, displayName.trim());
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err: any) {
            // Firebase may omit user-not-found for reset to prevent enumeration.
            // Surface a neutral success-style message for that case when resetting.
            if (mode === 'reset' && (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential')) {
                setInfo('If an account exists for that email, a reset link will be sent.');
            } else {
                setError(mapAuthError(err));
            }
            setMagicLinkSent(false);
        } finally {
            setIsSubmitting(false);
            setCompletingMagicLink(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setInfo('');
        setIsSubmitting(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setError(err.message || 'Failed to sign in with Google');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const switchMode = (next: AuthMode) => {
        setMode(next);
        setError('');
        setInfo('');
        setMagicLinkSent(false);
        if (next === 'reset') {
            setShowEmailForm(true);
        }
    };

    if (isLoading || completingMagicLink) {
        return (
            <div
                className="flex flex-col items-center justify-center min-h-screen bg-brand-950 gap-3"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <span className="sr-only">
                    {completingMagicLink ? 'Signing you in from email link' : 'Loading authentication'}
                </span>
                <div className="animate-spin h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full" aria-hidden="true"></div>
                {completingMagicLink && (
                    <p className="text-sm text-slate-400" aria-hidden="true">Signing you in from email link…</p>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-950 text-slate-200">
            <div className="lg:grid lg:grid-cols-[1.2fr_1fr] min-h-screen">

                {/* --- Left panel: value prop (desktop) --- */}
                <aside className="hidden lg:flex flex-col justify-between p-12 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.08),transparent_55%)] border-r border-brand-800" aria-label="Product highlights">
                    <div>
                        <Link to="/">
                            <img src="/logo.svg" alt="Cura.tor" className="h-10" />
                        </Link>
                    </div>

                    <div className="max-w-lg">
                        <h1 className="text-5xl font-bold text-white tracking-tight leading-[1.05]">
                            Every card.<br />Every contact.<br />One scan.
                        </h1>

                        <p className="text-lg text-slate-400 mt-5 leading-relaxed">
                            Stop retyping business cards. Cura.tor scans, parses, and organizes every contact — ready to export or sync in seconds.
                        </p>

                        <div className="mt-10 space-y-5">
                            {BENEFITS.map(({ icon: Icon, label, detail }) => (
                                <div key={label} className="flex gap-3 items-start">
                                    <Icon className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                                    <div>
                                        <p className="text-white font-medium text-sm">{label}</p>
                                        <p className="text-slate-500 text-sm">{detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <ShieldCheck size={12} aria-hidden="true" />
                        Contacts stay on your device. Card images go to Google AI only for extraction, then are not kept on our servers.
                    </p>
                </aside>

                {/* --- Right panel: auth card --- */}
                <main id="main-content" className="flex flex-col min-h-screen">
                    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
                        <div className="w-full max-w-sm">
                            {/* Mobile header */}
                            <div className="lg:hidden text-center mb-8">
                                <Link to="/">
                                    <img src="/logo.svg" alt="Cura.tor" className="h-9 mx-auto mb-6" />
                                </Link>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 mb-5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" aria-hidden="true" />
                                    <span className="text-[10px] font-medium text-sky-400 tracking-wide uppercase">In testing — early access</span>
                                </div>
                                <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                                    Every card. Every contact. One scan.
                                </h1>
                                <p className="text-sm text-slate-400 mt-2">
                                    Scan, parse, and organize every contact in seconds.
                                </p>
                            </div>

                            {mode === 'reset' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => switchMode('signin')}
                                        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-sky-400 mb-4 transition-colors"
                                    >
                                        <ArrowLeft size={14} aria-hidden="true" />
                                        Back to log in
                                    </button>
                                    <h2 className="text-xl font-bold text-white mb-1">Reset password</h2>
                                    <p className="text-sm text-slate-400 mb-6">
                                        Enter the email for your password account and we&apos;ll send a reset link.
                                    </p>
                                </>
                            ) : (
                                /* Mode tabs */
                                <div className="flex rounded-xl bg-brand-900 border border-brand-800 p-1 mb-6" role="tablist" aria-label="Authentication mode">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={mode === 'signin'}
                                        onClick={() => switchMode('signin')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-brand-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Log in
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={mode === 'signup'}
                                        onClick={() => switchMode('signup')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-brand-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Start free
                                    </button>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2" role="alert" aria-live="assertive">
                                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} aria-hidden="true" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {/* Success / info */}
                            {info && (
                                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2" role="status" aria-live="polite">
                                    <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={16} aria-hidden="true" />
                                    <p className="text-sm text-emerald-400">{info}</p>
                                </div>
                            )}

                            {/* In-app browser warning */}
                            {inAppBrowser && mode !== 'reset' && (
                                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30" role="status">
                                    <p className="text-xs text-amber-300">
                                        For Google sign-in, tap the menu and choose "Open in Chrome" or "Open in Safari". Email or magic link works here.
                                    </p>
                                </div>
                            )}

                            {mode !== 'reset' && (
                                <>
                                    {/* Primary: Google */}
                                    <button
                                        type="button"
                                        onClick={handleGoogleSignIn}
                                        disabled={isSubmitting || !!inAppBrowser}
                                        aria-label={inAppBrowser ? 'Google sign-in unavailable in this browser' : 'Continue with Google'}
                                        className={`w-full h-12 bg-white text-brand-950 font-semibold rounded-xl ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10 hover:ring-sky-400/40 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-3 ${inAppBrowser ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Continue with Google
                                    </button>

                                    <p className="text-xs text-slate-500 text-center mt-3">
                                        Free forever. Upgrade when you need more.
                                    </p>

                                    {/* Divider + email toggle */}
                                    <div className="flex items-center gap-3 my-6">
                                        <div className="flex-1 h-px bg-brand-800" aria-hidden="true"></div>
                                        <button
                                            type="button"
                                            onClick={() => setShowEmailForm(v => !v)}
                                            aria-expanded={showEmailForm}
                                            aria-controls="email-auth-form"
                                            className="text-xs text-slate-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
                                        >
                                            or use email
                                            <ChevronDown size={12} className={`transition-transform ${showEmailForm ? 'rotate-180' : ''}`} aria-hidden="true" />
                                        </button>
                                        <div className="flex-1 h-px bg-brand-800" aria-hidden="true"></div>
                                    </div>
                                </>
                            )}

                            {/* Email form */}
                            {(showEmailForm || mode === 'reset') && (
                                <div className="space-y-3 animate-in fade-in">
                                    {mode !== 'reset' && !needsEmailConfirm && (
                                        <div className="flex rounded-xl bg-brand-900/80 border border-brand-800 p-0.5" role="tablist" aria-label="Email sign-in method">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={emailMethod === 'magic'}
                                                onClick={() => { setEmailMethod('magic'); setError(''); setMagicLinkSent(false); }}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                                    emailMethod === 'magic' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                <Link2 size={12} aria-hidden="true" />
                                                Magic link
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={emailMethod === 'password'}
                                                onClick={() => { setEmailMethod('password'); setError(''); setInfo(''); setMagicLinkSent(false); }}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                                                    emailMethod === 'password' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                <Lock size={12} aria-hidden="true" />
                                                Password
                                            </button>
                                        </div>
                                    )}

                                    <form
                                        id="email-auth-form"
                                        onSubmit={handleEmailAuth}
                                        className="space-y-3"
                                        aria-label={
                                            mode === 'reset'
                                                ? 'Reset password'
                                                : needsEmailConfirm
                                                    ? 'Confirm email for magic link'
                                                    : emailMethod === 'magic'
                                                        ? 'Sign in with magic link'
                                                        : mode === 'signin'
                                                            ? 'Log in with email'
                                                            : 'Create account with email'
                                        }
                                    >
                                        {emailMethod === 'password' && mode === 'signup' && (
                                            <div className="relative">
                                                <label htmlFor="auth-display-name" className="sr-only">Full name</label>
                                                <User className="absolute left-3 top-3.5 text-slate-500" size={18} aria-hidden="true" />
                                                <input
                                                    id="auth-display-name"
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    placeholder="Full name"
                                                    autoComplete="name"
                                                    className="w-full bg-brand-900 border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                                                />
                                            </div>
                                        )}

                                        <div className="relative">
                                            <label htmlFor="auth-email" className="sr-only">Email address</label>
                                            <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} aria-hidden="true" />
                                            <input
                                                id="auth-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Email address"
                                                required
                                                autoComplete="email"
                                                inputMode="email"
                                                className="w-full bg-brand-900 border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                                            />
                                        </div>

                                        {mode !== 'reset' && emailMethod === 'password' && !needsEmailConfirm && (
                                            <div className="relative">
                                                <label htmlFor="auth-password" className="sr-only">Password</label>
                                                <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} aria-hidden="true" />
                                                <input
                                                    id="auth-password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder="Password"
                                                    required
                                                    minLength={6}
                                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                                    className="w-full bg-brand-900 border border-brand-800 rounded-xl py-3 pl-10 pr-10 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300"
                                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    aria-pressed={showPassword}
                                                >
                                                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                                                </button>
                                            </div>
                                        )}

                                        {mode === 'signin' && emailMethod === 'password' && (
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => switchMode('reset')}
                                                    className="text-xs text-slate-500 hover:text-sky-400 transition-colors"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            aria-busy={isSubmitting}
                                            className="w-full py-3 bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                                            ) : mode === 'reset' ? (
                                                'Send reset link'
                                            ) : needsEmailConfirm ? (
                                                'Confirm email & sign in'
                                            ) : emailMethod === 'magic' ? (
                                                magicLinkSent ? 'Resend magic link' : 'Email me a magic link'
                                            ) : mode === 'signin' ? (
                                                'Log in'
                                            ) : (
                                                'Start free'
                                            )}
                                        </button>

                                        {mode !== 'reset' && emailMethod === 'magic' && !needsEmailConfirm && (
                                            <p className="text-[10px] text-slate-500 text-center">
                                                No password — we email a one-time link. Works for new and returning users (great at events).
                                            </p>
                                        )}

                                        {emailMethod === 'password' && mode === 'signup' && (
                                            <p className="text-[10px] text-slate-500 text-center">
                                                We'll send a verification link to confirm your email.
                                            </p>
                                        )}
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                            <Link to="/accuracy#report" className="text-sky-400/90 hover:text-sky-300 underline-offset-2 hover:underline transition-colors">
                                See accuracy report
                            </Link>
                            <span className="text-slate-600"> — synthetic field metrics + samples</span>
                        </p>
                        <p className="text-xs text-slate-500">
                            By continuing, you agree to our{' '}
                            <Link to="/legal?tab=tos" className="text-slate-400 hover:text-sky-400 underline-offset-2 hover:underline transition-colors">Terms</Link>
                            {' '}and{' '}
                            <Link to="/legal?tab=privacy" className="text-slate-400 hover:text-sky-400 underline-offset-2 hover:underline transition-colors">Privacy</Link>
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Auth;
