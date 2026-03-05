import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
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

const Auth: React.FC = () => {
    const { user, isLoading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const inAppBrowser = useMemo(() => detectInAppBrowser(), []);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
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
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            <div className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Logo */}
                <div className="mb-8">
                    <img src="/logo.svg" alt="Cura.tor" className="w-64 mx-auto" />
                </div>

                {/* Error message */}
                {error && (
                    <div className="w-full max-w-sm mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* In-app browser warning */}
                {inAppBrowser && (
                    <div className="w-full max-w-sm mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <p className="text-sm text-amber-300 font-medium mb-1">
                            Open in your browser
                        </p>
                        <p className="text-xs text-amber-300/70 mb-3">
                            Google Sign-In doesn't work inside {inAppBrowser}. Tap the menu (•••) and choose "Open in Safari" or "Open in Chrome".
                        </p>
                        <p className="text-xs text-amber-300/50 flex items-center gap-1">
                            <ExternalLink size={12} />
                            You can still use email sign-in below
                        </p>
                    </div>
                )}

                {/* Google Sign In */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting || !!inAppBrowser}
                    className={`w-full max-w-sm py-3.5 glass border border-brand-800 rounded-xl font-medium flex items-center justify-center gap-3 hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50 mb-6 ${inAppBrowser ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                {/* Divider */}
                <div className="w-full max-w-sm flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-brand-800"></div>
                    <span className="text-xs text-slate-600 uppercase">or</span>
                    <div className="flex-1 h-px bg-brand-800"></div>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="w-full max-w-sm space-y-3">
                    {mode === 'signup' && (
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 text-brand-500" size={18} />
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Full Name"
                                className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-brand-500" size={18} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email address"
                            required
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-brand-500" size={18} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            minLength={6}
                            className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-10 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3.5 text-brand-500 hover:text-brand-400"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            mode === 'signin' ? 'Sign In' : 'Create Account'
                        )}
                    </button>
                </form>

                {/* Toggle mode */}
                <p className="mt-6 text-sm text-slate-500">
                    {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                        className="text-brand-400 font-medium hover:text-brand-300"
                    >
                        {mode === 'signin' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>

            {/* Footer */}
            <div className="p-4 text-center">
                <p className="text-xs text-slate-600">Cura.tor v1.0 Beta</p>
            </div>
        </div>
    );
};

export default Auth;
