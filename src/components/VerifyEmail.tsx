import { useEffect, useState } from 'react';
import { MailCheck, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmail() {
    const { firebaseUser, resendVerificationEmail, reloadFirebaseUser, signOut } = useAuth();
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);

    // Poll for verification every 5s so the user doesn't have to click "I've verified".
    // When they click the link in their email, Firebase updates the user record server-side;
    // reloadFirebaseUser() pulls the fresh state and React re-renders, releasing the gate.
    useEffect(() => {
        const interval = setInterval(() => {
            reloadFirebaseUser().catch(() => {});
        }, 5000);
        return () => clearInterval(interval);
    }, [reloadFirebaseUser]);

    const handleResend = async () => {
        setResending(true);
        setError('');
        setResent(false);
        try {
            await resendVerificationEmail();
            setResent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to resend. Try again in a minute.');
        } finally {
            setResending(false);
        }
    };

    const handleCheck = async () => {
        setChecking(true);
        setError('');
        try {
            await reloadFirebaseUser();
        } catch (err: any) {
            setError(err.message || 'Check failed.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-brand-950 text-slate-200 p-6">
            <div className="w-full max-w-md text-center space-y-5">
                <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/20 flex items-center justify-center">
                    <MailCheck className="w-8 h-8 text-sky-400" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-xl font-semibold">Verify your email</h1>
                    <p className="text-sm text-slate-400">
                        We sent a verification link to
                    </p>
                    <p className="text-sm font-semibold text-slate-200 break-all">
                        {firebaseUser?.email}
                    </p>
                    <p className="text-xs text-slate-500 pt-2">
                        Click the link in the email to finish setting up your account. This page will unlock automatically once verified.
                    </p>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-sm">
                        {error}
                    </div>
                )}

                {resent && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm">
                        Verification email sent. Check your inbox (and spam folder).
                    </div>
                )}

                <div className="space-y-2">
                    <button
                        onClick={handleCheck}
                        disabled={checking}
                        className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        I've verified — continue
                    </button>

                    <button
                        onClick={handleResend}
                        disabled={resending}
                        className="w-full py-2.5 glass border border-brand-800 hover:bg-white/5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                        {resending ? 'Sending…' : 'Resend verification email'}
                    </button>

                    <button
                        onClick={signOut}
                        className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <LogOut size={12} />
                        Sign out and use a different account
                    </button>
                </div>
            </div>
        </div>
    );
}
