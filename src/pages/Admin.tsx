import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Check, X, RefreshCw, Users, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { OWNER_EMAILS } from '@/config/firebase';
import {
    listEnterpriseRequests,
    approveEnterpriseRequest,
    rejectEnterpriseRequest,
    grantTrial,
} from '@/services/enterpriseRequests';
import { EnterpriseRequest } from '@/types/enterpriseRequest';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export default function Admin() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [requests, setRequests] = useState<EnterpriseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<Filter>('pending');
    const [actioning, setActioning] = useState<string | null>(null);
    const [approveModal, setApproveModal] = useState<EnterpriseRequest | null>(null);
    const [rejectModal, setRejectModal] = useState<EnterpriseRequest | null>(null);
    const [seatLimit, setSeatLimit] = useState('10');
    const [rejectReason, setRejectReason] = useState('');

    // Grant trial state
    const [grantModal, setGrantModal] = useState(false);
    const [granting, setGranting] = useState(false);
    const [grantResult, setGrantResult] = useState<string | null>(null);
    const [gTargetUid, setGTargetUid] = useState('');
    const [gTier, setGTier] = useState<'early_access' | 'pro'>('early_access');
    const [gScanLimit, setGScanLimit] = useState('500');
    const [gContactLimit, setGContactLimit] = useState('500');
    const [gExpiresAt, setGExpiresAt] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
    });

    const isOwner = !!user?.email && OWNER_EMAILS
        .map(e => e.toLowerCase())
        .includes(user.email.toLowerCase());

    useEffect(() => {
        if (!isOwner) {
            navigate('/');
            return;
        }
        load();
    }, [isOwner]);

    async function load() {
        setLoading(true);
        setError('');
        try {
            const all = await listEnterpriseRequests();
            setRequests(all.sort((a, b) => b.createdAt - a.createdAt));
        } catch (err: any) {
            setError(err.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove() {
        if (!approveModal) return;
        const seats = Number(seatLimit);
        if (!seats || seats < 1) {
            setError('Seat limit must be a positive number');
            return;
        }
        setActioning(approveModal.id);
        try {
            await approveEnterpriseRequest(approveModal.id, seats);
            setApproveModal(null);
            setSeatLimit('10');
            await load();
        } catch (err: any) {
            setError(err.message || 'Approval failed');
        } finally {
            setActioning(null);
        }
    }

    async function handleGrantTrial() {
        setError('');
        setGrantResult(null);

        const uid = gTargetUid.trim();
        if (!uid) {
            setError('Target UID is required');
            return;
        }
        const scanLimit = gScanLimit.trim() === '' ? null : Number(gScanLimit);
        const contactLimit = gContactLimit.trim() === '' ? null : Number(gContactLimit);
        if (scanLimit !== null && (!Number.isFinite(scanLimit) || scanLimit < 1)) {
            setError('Scan limit must be a positive number or blank for unlimited');
            return;
        }
        if (contactLimit !== null && (!Number.isFinite(contactLimit) || contactLimit < 1)) {
            setError('Contact limit must be a positive number or blank for unlimited');
            return;
        }
        // Interpret the date as end-of-day local time so the user has the full day
        const d = new Date(gExpiresAt + 'T23:59:59');
        const expiresAt = d.getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            setError('Expiry date must be in the future');
            return;
        }

        setGranting(true);
        try {
            await grantTrial({ targetUid: uid, tier: gTier, scanLimit, contactLimit, expiresAt });
            setGrantResult(`Granted ${gTier} to ${uid} until ${d.toLocaleDateString()}`);
            setGTargetUid('');
        } catch (err: any) {
            setError(err.message || 'Grant failed');
        } finally {
            setGranting(false);
        }
    }

    async function handleReject() {
        if (!rejectModal) return;
        setActioning(rejectModal.id);
        try {
            await rejectEnterpriseRequest(rejectModal.id, rejectReason);
            setRejectModal(null);
            setRejectReason('');
            await load();
        } catch (err: any) {
            setError(err.message || 'Rejection failed');
        } finally {
            setActioning(null);
        }
    }

    const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    if (!isOwner) return null;

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/settings')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Admin Panel</h1>
                <button onClick={load} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                <button
                    onClick={() => setGrantModal(true)}
                    className="w-full card-elevated rounded-2xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">Grant Trial Access</p>
                        <p className="text-xs text-slate-500">Give someone Pioneer or Pro with an expiry date</p>
                    </div>
                </button>

                {grantResult && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm flex items-start justify-between gap-2">
                        <span>{grantResult}</span>
                        <button onClick={() => setGrantResult(null)} className="p-1 hover:bg-white/10 rounded-lg">
                            <X size={14} />
                        </button>
                    </div>
                )}

                <div className="card-elevated rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Enterprise Requests</p>
                        <p className="text-xs text-slate-500">
                            {pendingCount} pending · {requests.length} total
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filter === f ? 'bg-sky-500 text-white' : 'bg-brand-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <p className="text-center text-slate-500 text-sm py-8">Loading…</p>
                ) : filtered.length === 0 ? (
                    <div className="card-elevated rounded-2xl p-8 text-center">
                        <Users className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                        <p className="text-sm text-slate-400">No {filter === 'all' ? '' : filter} requests</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(r => (
                            <div key={r.id} className="card-elevated rounded-2xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm">{r.orgName}</p>
                                        <p className="text-xs text-slate-500">
                                            {r.displayName} · {r.email}
                                        </p>
                                    </div>
                                    <StatusBadge status={r.status} />
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="text-slate-500">Team size</p>
                                        <p className="text-slate-300">{r.teamSize}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Contact</p>
                                        <p className="text-slate-300 truncate">{r.contactEmail}</p>
                                    </div>
                                </div>

                                {r.notes && (
                                    <div className="text-xs">
                                        <p className="text-slate-500 mb-1">Notes</p>
                                        <p className="text-slate-300 whitespace-pre-wrap">{r.notes}</p>
                                    </div>
                                )}

                                <p className="text-[10px] text-slate-600">
                                    Submitted {new Date(r.createdAt).toLocaleString()}
                                </p>

                                {r.status === 'pending' && (
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => setApproveModal(r)}
                                            disabled={actioning === r.id}
                                            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Check size={14} />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => setRejectModal(r)}
                                            disabled={actioning === r.id}
                                            className="flex-1 py-2 bg-red-500/80 hover:bg-red-500 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <X size={14} />
                                            Reject
                                        </button>
                                    </div>
                                )}

                                {r.status === 'approved' && r.orgId && (
                                    <p className="text-[10px] text-emerald-400/70">Org ID: {r.orgId}</p>
                                )}
                                {r.status === 'rejected' && r.rejectionReason && (
                                    <p className="text-[10px] text-red-400/70">Reason: {r.rejectionReason}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {approveModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6" onClick={() => !actioning && setApproveModal(null)}>
                    <div className="bg-brand-900 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-1">Approve request</h2>
                        <p className="text-sm text-slate-400 mb-4">
                            Provision <span className="text-slate-200 font-medium">{approveModal.orgName}</span> for {approveModal.email}?
                        </p>
                        <label className="text-xs text-slate-400 block mb-1">Seat limit</label>
                        <input
                            type="number"
                            min="1"
                            value={seatLimit}
                            onChange={e => setSeatLimit(e.target.value)}
                            className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setApproveModal(null)}
                                disabled={!!actioning}
                                className="flex-1 py-2 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={!!actioning}
                                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                {actioning ? 'Provisioning…' : 'Provision'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {grantModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6" onClick={() => !granting && setGrantModal(false)}>
                    <div className="bg-brand-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Grant Trial Access</h2>
                            <button onClick={() => !granting && setGrantModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Target user UID</label>
                                <input
                                    value={gTargetUid}
                                    onChange={e => setGTargetUid(e.target.value)}
                                    placeholder="Firebase UID (from Console → Authentication)"
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Tier</label>
                                <div className="flex gap-2">
                                    {(['early_access', 'pro'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setGTier(t)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                                gTier === t ? 'bg-sky-500 text-white' : 'bg-brand-800 text-slate-400'
                                            }`}
                                        >
                                            {t === 'early_access' ? 'Pioneer' : 'Pro'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Scan limit (blank = unlimited)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={gScanLimit}
                                    onChange={e => setGScanLimit(e.target.value)}
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Contact limit (blank = unlimited)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={gContactLimit}
                                    onChange={e => setGContactLimit(e.target.value)}
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Expiry date (access revokes at end-of-day)</label>
                                <input
                                    type="date"
                                    value={gExpiresAt}
                                    onChange={e => setGExpiresAt(e.target.value)}
                                    className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setGrantModal(false)}
                                    disabled={granting}
                                    className="flex-1 py-2 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGrantTrial}
                                    disabled={granting}
                                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-semibold disabled:opacity-50"
                                >
                                    {granting ? 'Granting…' : 'Grant access'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {rejectModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6" onClick={() => !actioning && setRejectModal(null)}>
                    <div className="bg-brand-900 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-1">Reject request</h2>
                        <p className="text-sm text-slate-400 mb-4">
                            Reject <span className="text-slate-200 font-medium">{rejectModal.orgName}</span>?
                        </p>
                        <label className="text-xs text-slate-400 block mb-1">Reason (optional, internal note)</label>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-sky-500 outline-none resize-none mb-4"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRejectModal(null)}
                                disabled={!!actioning}
                                className="flex-1 py-2 bg-brand-800 hover:bg-brand-700 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!!actioning}
                                className="flex-1 py-2 bg-red-500/80 hover:bg-red-500 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                {actioning ? 'Rejecting…' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: EnterpriseRequest['status'] }) {
    const styles: Record<EnterpriseRequest['status'], string> = {
        pending: 'bg-amber-500/20 text-amber-400',
        approved: 'bg-emerald-500/20 text-emerald-400',
        rejected: 'bg-red-500/20 text-red-400',
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${styles[status]} shrink-0`}>
            {status.toUpperCase()}
        </span>
    );
}
