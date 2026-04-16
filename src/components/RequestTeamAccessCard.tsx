import React, { useState } from 'react';
import { Users, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { submitEnterpriseRequest } from '@/services/enterpriseRequests';

export default function RequestTeamAccessCard() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const [orgName, setOrgName] = useState('');
    const [teamSize, setTeamSize] = useState('5');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [notes, setNotes] = useState('');

    const canSubmit = orgName.trim().length > 0
        && Number(teamSize) >= 1
        && contactEmail.trim().length > 0
        && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError('');
        try {
            await submitEnterpriseRequest({
                orgName,
                teamSize: Number(teamSize),
                contactEmail,
                notes,
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Failed to submit. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setIsOpen(false);
        setSubmitted(false);
        setError('');
        setOrgName('');
        setTeamSize('5');
        setNotes('');
    };

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Team Plan</p>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full card-elevated rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            >
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Need a shared team workspace?</p>
                    <p className="text-xs text-slate-500">Request enterprise access — we'll get back to you.</p>
                </div>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={reset}>
                    <div className="bg-brand-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Request Team Access</h2>
                            <button onClick={reset} className="p-1 hover:bg-white/10 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        {submitted ? (
                            <div className="py-8 text-center space-y-3">
                                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <Check className="w-6 h-6 text-emerald-400" />
                                </div>
                                <p className="font-semibold">Request received</p>
                                <p className="text-sm text-slate-400">We'll reach out to {contactEmail} within a few business days.</p>
                                <button
                                    onClick={reset}
                                    className="mt-4 px-4 py-2 bg-sky-500 rounded-xl text-sm font-semibold"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Organization name</label>
                                    <input
                                        value={orgName}
                                        onChange={e => setOrgName(e.target.value)}
                                        placeholder="Acme Corp"
                                        className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Estimated team size</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={teamSize}
                                        onChange={e => setTeamSize(e.target.value)}
                                        className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Contact email</label>
                                    <input
                                        type="email"
                                        value={contactEmail}
                                        onChange={e => setContactEmail(e.target.value)}
                                        className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Use case, timeline, questions…"
                                        className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none resize-none"
                                    />
                                </div>

                                {error && (
                                    <p className="text-xs text-red-400">{error}</p>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
                                >
                                    {submitting ? 'Sending…' : 'Submit request'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
