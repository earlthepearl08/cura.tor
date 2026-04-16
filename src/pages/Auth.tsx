import React, { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
    Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle,
    ScanLine, Users as UsersIcon, FileDown, WifiOff, ChevronDown, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
    { icon: ScanLine, label: 'Scan in seconds', detail: 'AI reads even stylized or crumpled cards' },
    { icon: UsersIcon, label: 'Never lose a lead', detail: 'Saved to your device, synced to Google Drive' },
    { icon: FileDown, label: 'Export anywhere', detail: 'vCard, CSV, or Excel — no retyping' },
    { icon: WifiOff, label: 'Works offline', detail: 'Scan at events with zero signal' },
];

const Auth: React.FC = () => {
    const { user, isLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const inAppBrowser = useMemo(() => detectInAppBrowser(), []);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Already signed in — redirect to home
    if (!isLoading && user) {
        return <Navigate to="/" replace />;
    }

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
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
            const code = err.code || '';
            if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
                setError('Invalid email or password');
            } else if (code === 'auth/email-already-in-use') {
                setError('An account with this email already exists');
            } else if (code === 'auth/weak-password') {
                setError('Password must be at least 6 characters');
            } else if (code === 'auth/invalid-email') {
                setError('Please enter a valid email address');
            } else {
                setError(err.message || 'Something went wrong');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-950">
                <div className="animate-spin h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-950 text-slate-200">
            <div className="lg:grid lg:grid-cols-[1.2fr_1fr] min-h-screen">

                {/* --- Left panel: value prop (desktop) --- */}
                <div className="hidden lg:flex flex-col justify-between p-12 bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.08),transparent_55%)] border-r border-brand-800">
                    <div>
                        <img src="/logo.svg" alt="Cura.tor" className="h-10" />
                    </div>

                    <div className="max-w-lg">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 mb-6">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                            <span className="text-xs font-medium text-sky-400 tracking-wide">In testing — early access</span>
                        </div>

                        <h1 className="text-5xl font-bold text-white tracking-tight leading-[1.05]">
                            Every card.<br />Every contact.<br />One scan.
                        </h1>

                        <p className="text-lg text-slate-400 mt-5 leading-relaxed">
                            Stop retyping business cards. Cura.tor scans, parses, and organizes every contact — ready to export or sync in seconds.
                        </p>

                        <div className="mt-10 space-y-5">
                            {BENEFITS.map(({ icon: Icon, label, detail }) => (
                                <div key={label} className="flex gap-3 items-start">
                                    <Icon className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium text-sm">{label}</p>
                                        <p className="text-slate-500 text-sm">{detail}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        Your scans stay on your device. We never read your contacts.
                    </p>
                </div>

                {/* --- Right panel: auth card --- */}
                <div className="flex flex-col min-h-screen">
                    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
                        <div className="w-full max-w-sm">
                            {/* Mobile header */}
                            <div className="lg:hidden text-center mb-8">
                                <img src="/logo.svg" alt="Cura.tor" className="h-9 mx-auto mb-6" />
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 mb-5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                    <span className="text-[10px] font-medium text-sky-400 tracking-wide uppercase">In testing — early access</span>
                                </div>
                                <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                                    Every card. Every contact. One scan.
                                </h1>
                                <p className="text-sm text-slate-400 mt-2">
                                    Scan, parse, and organize every contact in seconds.
                                </p>
                            </div>

                            {/* Mode tabs */}
                            <div className="flex rounded-xl bg-brand-900 border border-brand-800 p-1 mb-6">
                                <button
                                    onClick={() => { setMode('signin'); setError(''); }}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signin' ? 'bg-brand-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Log in
                                </button>
                                <button
                                    onClick={() => { setMode('signup'); setError(''); }}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-brand-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Start free
                                </button>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            {/* In-app browser warning */}
                            {inAppBrowser && (
                                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                    <p className="text-xs text-amber-300">
                                        For Google sign-in, tap the menu and choose "Open in Chrome" or "Open in Safari". Email sign-in works here.
                                    </p>
                                </div>
                            )}

                            {/* Primary: Google */}
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={isSubmitting || !!inAppBrowser}
                                className={`w-full h-12 bg-white text-brand-950 font-semibold rounded-xl ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10 hover:ring-sky-400/40 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-3 ${inAppBrowser ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                                <div className="flex-1 h-px bg-brand-800"></div>
                                <button
                                    onClick={() => setShowEmailForm(v => !v)}
                                    className="text-xs text-slate-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
                                >
                                    or use email
                                    <ChevronDown size={12} className={`transition-transform ${showEmailForm ? 'rotate-180' : ''}`} />
                                </button>
                                <div className="flex-1 h-px bg-brand-800"></div>
                            </div>

                            {/* Email form (collapsed by default) */}
                            {showEmailForm && (
                                <form onSubmit={handleEmailAuth} className="space-y-3 animate-in fade-in">
                                    {mode === 'signup' && (
                                        <div className="relative">
                                            <User className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                            <input
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
                                        <Mail className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                        <input
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

                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                        <input
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
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : (
                                            mode === 'signin' ? 'Log in' : 'Start free'
                                        )}
                                    </button>

                                    {mode === 'signup' && (
                                        <p className="text-[10px] text-slate-500 text-center">
                                            We'll send a verification link to confirm your email.
                                        </p>
                                    )}
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 text-center">
                        <p className="text-xs text-slate-500">
                            By continuing, you agree to our{' '}
                            <Link to="/legal?tab=tos" className="text-slate-400 hover:text-sky-400 underline-offset-2 hover:underline transition-colors">Terms</Link>
                            {' '}and{' '}
                            <Link to="/legal?tab=privacy" className="text-slate-400 hover:text-sky-400 underline-offset-2 hover:underline transition-colors">Privacy</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
