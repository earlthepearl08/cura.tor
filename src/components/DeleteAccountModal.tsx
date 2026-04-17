import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Loader2, Check } from 'lucide-react';
import {
    deleteUser,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    EmailAuthProvider,
    GoogleAuthProvider,
} from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { authFetch } from '@/utils/authFetch';
import { storage as personalStorage } from '@/services/storage';

interface Props {
    onClose: () => void;
}

export default function DeleteAccountModal({ onClose }: Props) {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [step, setStep] = useState<1 | 2>(1);
    const [confirmText, setConfirmText] = useState('');
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [requestSubmitted, setRequestSubmitted] = useState(false);

    const expected = user?.email || '';
    const canProceed = confirmText.trim().toLowerCase() === expected.toLowerCase();
    const needsPasswordReauth = auth.currentUser?.providerData[0]?.providerId === 'password';
    const isTeamAdmin = user?.orgRole === 'admin' && !!user?.organizationId;

    // Team admins can't self-delete — they submit a request for the platform owner to process.
    const submitDeletionRequest = async () => {
        setError('');
        setSubmitting(true);
        try {
            const current = auth.currentUser;
            if (!current) throw new Error('Not signed in');
            await addDoc(collection(db, 'enterpriseRequests'), {
                uid: current.uid,
                email: current.email || '',
                displayName: current.displayName || current.email?.split('@')[0] || 'User',
                orgName: 'Account Deletion Request',
                teamSize: 0,
                contactEmail: current.email || '',
                notes: reason.trim() || 'No reason provided.',
                status: 'pending',
                type: 'account-deletion',
                createdAt: serverTimestamp(),
            });
            setRequestSubmitted(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    const runDeletion = async () => {
        setError('');
        setSubmitting(true);
        try {
            const current = auth.currentUser;
            if (!current) throw new Error('Not signed in');

            // Step 1: server cleanup (org membership, sent invites, enterprise
            // requests, user doc). Runs first so we don't orphan team state if
            // the client-side auth deletion fails afterwards.
            const res = await authFetch('/api/account', { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Server-side deletion failed');
            }

            // Step 2: delete the Firebase Auth record. This can fail with
            // auth/requires-recent-login if the session is stale — we catch
            // that specifically and try a fresh reauth once.
            try {
                await deleteUser(current);
            } catch (err: any) {
                if (err?.code === 'auth/requires-recent-login') {
                    if (needsPasswordReauth) {
                        if (!password) {
                            throw new Error('For security, re-enter your password below and try again.');
                        }
                        const credential = EmailAuthProvider.credential(current.email!, password);
                        await reauthenticateWithCredential(current, credential);
                    } else {
                        await reauthenticateWithPopup(current, new GoogleAuthProvider());
                    }
                    await deleteUser(current);
                } else {
                    throw err;
                }
            }

            // Step 3: wipe local caches. IndexedDB first, then sign-out state.
            try {
                if (current.uid) {
                    indexedDB.deleteDatabase(`CardScannerDB_${current.uid}`);
                }
                indexedDB.deleteDatabase('CardScannerDB');
            } catch { /* harmless */ }
            personalStorage.switchUser(null);
            sessionStorage.clear();
            localStorage.removeItem('workspace_mode');

            // Step 4: sign out locally and redirect.
            await signOut();
            navigate('/auth', { replace: true });
        } catch (err: any) {
            setError(err?.message || 'Deletion failed. Please try again or contact support.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => !submitting && onClose()}>
            <div className="bg-brand-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle size={16} className="text-red-400" />
                        </div>
                        <h2 className="text-lg font-semibold">Delete account</h2>
                    </div>
                    <button onClick={() => !submitting && onClose()} className="p-1 hover:bg-white/10 rounded-lg" disabled={submitting}>
                        <X size={18} />
                    </button>
                </div>

                {/* Team admin path: request deletion instead of self-delete */}
                {isTeamAdmin ? (
                    requestSubmitted ? (
                        <div className="py-6 text-center space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="font-semibold">Deletion request submitted</p>
                            <p className="text-sm text-slate-400">
                                We'll review your request and process it within a few business days. You'll be notified at {expected}.
                            </p>
                            <button onClick={onClose} className="mt-2 px-4 py-2 bg-sky-500 rounded-xl text-sm font-semibold">
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-300">
                                As a team admin, your account can't be deleted instantly — your team depends on it.
                            </p>
                            <p className="text-sm text-slate-400">
                                Submit a deletion request and we'll process it after verifying your team's data is safe. This usually takes a few business days.
                            </p>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Reason (optional)</label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    rows={3}
                                    placeholder="Why are you leaving?"
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-red-500 outline-none resize-none"
                                />
                            </div>
                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={onClose} disabled={submitting} className="flex-1 py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold disabled:opacity-50">
                                    Cancel
                                </button>
                                <button
                                    onClick={submitDeletionRequest}
                                    disabled={submitting}
                                    className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {submitting ? 'Submitting…' : 'Request deletion'}
                                </button>
                            </div>
                        </div>
                    )
                ) : step === 1 ? (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300">
                            This will permanently:
                        </p>
                        <ul className="text-sm text-slate-400 space-y-1.5 list-disc list-inside">
                            <li>Delete your Cura.tor account and profile</li>
                            <li>Wipe this device's scan archive (contacts + photos)</li>
                            <li>Remove you from any team you're a member of</li>
                            <li>Revoke invites you've sent</li>
                            <li>Cancel any pending enterprise requests</li>
                        </ul>
                        <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            <strong className="text-amber-400">Heads up:</strong> contacts you've added to a team workspace stay with the team. Your personal scan archive and Google Drive sync token are wiped from this device.
                        </p>
                        <p className="text-xs text-slate-500">
                            This cannot be undone. If you change your mind, you'd have to sign up fresh.
                        </p>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 rounded-xl text-sm font-semibold"
                            >
                                I understand, continue
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300">
                            Type <span className="text-slate-100 font-mono bg-brand-800 px-1.5 py-0.5 rounded">{expected}</span> to confirm.
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            placeholder={expected}
                            autoComplete="off"
                            className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-red-500 outline-none font-mono"
                        />

                        {needsPasswordReauth && (
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Re-enter password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-red-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Firebase may require a fresh sign-in before deleting.</p>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setStep(1)}
                                disabled={submitting}
                                className="flex-1 py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button
                                onClick={runDeletion}
                                disabled={!canProceed || submitting}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                {submitting ? 'Deleting…' : 'Permanently delete'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
