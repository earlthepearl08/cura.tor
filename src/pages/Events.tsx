import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, CalendarDays, Copy, Check, Loader2, Users, LogOut, Ban,
    RefreshCw, KeyRound, Sparkles, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
    createEventWorkspace,
    joinEventWorkspace,
    leaveEventWorkspace,
    endEventWorkspace,
    rotateEventJoinCode,
    formatEventExpiry,
    isEventActive,
    getEventMembers,
    listEventWorkspaces,
} from '@/services/eventService';
import type { EventListItem, EventHostCapacity } from '@/services/eventService';
import {
    EVENT_SEAT_DEFAULT,
    EVENT_SEAT_MAX,
    EVENT_SEAT_MIN,
    DEFAULT_EVENT_DURATION_DAYS,
    EventMember,
} from '@/types/eventWorkspace';
import { createEventPackCheckoutSession, EVENT_PACK_PRICE } from '@/services/stripe';

const Events: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { refreshUserProfile, user } = useAuth();
    const { events, switchTo, refreshEvents, event: activeEvent, mode } = useWorkspace();

    const [name, setName] = useState('');
    const [seatLimit, setSeatLimit] = useState(EVENT_SEAT_DEFAULT);
    const [durationDays, setDurationDays] = useState(DEFAULT_EVENT_DURATION_DAYS);
    const [joinCode, setJoinCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [membersByEvent, setMembersByEvent] = useState<Record<string, EventMember[]>>({});
    const [capacity, setCapacity] = useState<EventHostCapacity | null>(null);

    const loadCapacity = async () => {
        try {
            const { capacity: cap } = await listEventWorkspaces();
            setCapacity(cap);
        } catch {
            // ignore — events list still comes from context
        }
    };

    useEffect(() => {
        refreshEvents();
        loadCapacity();
    }, []);

    // Stripe Event pack return — honest pending/confirm (webhook grants credits)
    useEffect(() => {
        const payment = searchParams.get('payment');
        if (!payment) return;

        const clear = () => {
            const next = new URLSearchParams(searchParams);
            next.delete('payment');
            setSearchParams(next, { replace: true });
        };

        if (payment === 'canceled') {
            setError('Checkout canceled. No charge was made.');
            clear();
            return;
        }

        if (payment !== 'success') return;

        let cancelled = false;
        const confirm = async () => {
            setSuccess('Checkout complete. Confirming Event pack credits…');
            clear();
            const before = user?.eventPackCredits ?? 0;
            for (let i = 0; i < 5 && !cancelled; i++) {
                if (i > 0) await new Promise((r) => setTimeout(r, 2000));
                try {
                    const profile = await refreshUserProfile();
                    const credits = profile?.eventPackCredits ?? 0;
                    if (credits > before) {
                        if (!cancelled) {
                            flashSuccess(`Event pack unlocked — ${credits} host slot${credits === 1 ? '' : 's'} from packs.`);
                            await loadCapacity();
                            await refreshEvents();
                        }
                        return;
                    }
                } catch {
                    // keep polling
                }
            }
            if (!cancelled) {
                setSuccess('Payment received. Credits appear once billing confirms — refresh in a minute if needed.');
                await loadCapacity();
            }
        };
        void confirm();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Load members for events the user hosts (to show seat usage)
        events.filter((e) => e.isHost).forEach(async (ev) => {
            try {
                const members = await getEventMembers(ev.id);
                setMembersByEvent((prev) => ({ ...prev, [ev.id]: members }));
            } catch {
                // ignore
            }
        });
    }, [events.map((e) => e.id).join('|')]);

    const flashSuccess = (msg: string) => {
        setSuccess(msg);
        setError('');
        setTimeout(() => setSuccess(''), 4000);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError('');
        const result = await createEventWorkspace({
            name: name.trim(),
            seatLimit,
            durationDays,
        });
        setBusy(false);
        if (!result.success || !result.eventId) {
            setError(result.message);
            if (result.message.toLowerCase().includes('event pack') || result.message.toLowerCase().includes('host slot')) {
                // capacity error — capacity banner already explains buy path
                await loadCapacity();
            }
            return;
        }
        setName('');
        await refreshUserProfile();
        await refreshEvents();
        await loadCapacity();
        switchTo('event', result.eventId);
        flashSuccess(`Event created. Share code ${result.joinCode}`);
    };

    const handleBuyEventPack = async () => {
        setBusy(true);
        setError('');
        try {
            const url = await createEventPackCheckoutSession();
            window.location.href = url;
        } catch (err: any) {
            setError(err.message || 'Could not start Event pack checkout');
            setBusy(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        setBusy(true);
        setError('');
        const result = await joinEventWorkspace(joinCode.trim());
        setBusy(false);
        if (!result.success || !result.eventId) {
            setError(result.message);
            return;
        }
        setJoinCode('');
        await refreshUserProfile();
        await refreshEvents();
        switchTo('event', result.eventId);
        flashSuccess(result.alreadyMember ? `Opened ${result.name}` : `Joined ${result.name}`);
    };

    const copyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch {
            setError('Could not copy code');
        }
    };

    const openEvent = (ev: EventListItem) => {
        switchTo('event', ev.id);
        navigate('/contacts');
    };

    const handleLeave = async (eventId: string) => {
        if (!window.confirm('Leave this event? You will lose access to its shared contacts.')) return;
        setBusy(true);
        const result = await leaveEventWorkspace(eventId);
        setBusy(false);
        if (!result.success) {
            setError(result.message);
            return;
        }
        if (mode === 'event' && activeEvent?.id === eventId) {
            switchTo('personal');
        }
        await refreshUserProfile();
        await refreshEvents();
        flashSuccess('Left event');
    };

    const handleEnd = async (eventId: string) => {
        if (!window.confirm('End this event? Members can no longer add or edit shared contacts.')) return;
        setBusy(true);
        const result = await endEventWorkspace(eventId);
        setBusy(false);
        if (!result.success) {
            setError(result.message);
            return;
        }
        await refreshEvents();
        flashSuccess('Event ended');
    };

    const handleRotate = async (eventId: string) => {
        setBusy(true);
        const result = await rotateEventJoinCode(eventId);
        setBusy(false);
        if (!result.success) {
            setError(result.message);
            return;
        }
        await refreshEvents();
        if (result.joinCode) {
            flashSuccess(`New code: ${result.joinCode}`);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Event packs</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-6 max-w-lg mx-auto w-full space-y-6">
                <div className="card-elevated rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        <p className="text-sm font-semibold">Lightweight show workspace</p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Spin up a temporary shared space for 2–{EVENT_SEAT_MAX} people at one trade show.
                        Share a short code — no enterprise request. Contacts and claims stay in the event until it ends.
                    </p>
                </div>

                {/* Host capacity + Event pack purchase */}
                <div className="card-elevated rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Host capacity</p>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Active events you host</span>
                        <span className="font-medium">
                            {capacity
                                ? `${capacity.activeHosted} / ${capacity.hostLimit}`
                                : `${user?.eventPackCredits ?? 0} pack credit(s)`}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        Includes {capacity?.freeHostSlots ?? 1} free slot
                        {(capacity?.eventPackCredits ?? user?.eventPackCredits ?? 0) > 0
                            ? ` + ${capacity?.eventPackCredits ?? user?.eventPackCredits} from Event packs`
                            : ''}.
                        Buy a one-time Event pack to host another concurrent show.
                    </p>
                    <button
                        type="button"
                        onClick={handleBuyEventPack}
                        disabled={busy || !EVENT_PACK_PRICE.id}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-brand-950 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                        Buy Event pack ({EVENT_PACK_PRICE.amountLabel})
                    </button>
                    {!EVENT_PACK_PRICE.id && (
                        <p className="text-[11px] text-amber-400/80">
                            Set VITE_STRIPE_EVENT_PACK_PRICE_ID to enable checkout (placeholder price ID).
                        </p>
                    )}
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm">{error}</div>
                )}
                {success && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">{success}</div>
                )}

                {/* Create */}
                <form onSubmit={handleCreate} className="card-elevated rounded-2xl p-4 space-y-4">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Create event</p>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Show / event name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Manila Food Expo 2026"
                            maxLength={80}
                            className="w-full px-3 py-2.5 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-amber-500 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Seats ({EVENT_SEAT_MIN}–{EVENT_SEAT_MAX})</label>
                            <input
                                type="number"
                                min={EVENT_SEAT_MIN}
                                max={EVENT_SEAT_MAX}
                                value={seatLimit}
                                onChange={(e) => setSeatLimit(Number(e.target.value))}
                                className="w-full px-3 py-2.5 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-amber-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Duration (days)</label>
                            <select
                                value={durationDays}
                                onChange={(e) => setDurationDays(Number(e.target.value))}
                                className="w-full px-3 py-2.5 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-amber-500 outline-none"
                            >
                                <option value={3}>3 days</option>
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={busy || !name.trim()}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-brand-950 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
                        Create event pack
                    </button>
                </form>

                {/* Join */}
                <form onSubmit={handleJoin} className="card-elevated rounded-2xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Join with code</p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="EVT-XXXX"
                                autoCapitalize="characters"
                                className="w-full pl-9 pr-3 py-2.5 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-emerald-500 outline-none font-mono uppercase tracking-wider"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={busy || !joinCode.trim()}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-brand-950 rounded-xl text-sm font-bold disabled:opacity-50"
                        >
                            Join
                        </button>
                    </div>
                </form>

                {/* Your events */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Your events</p>
                        <button
                            onClick={() => refreshEvents()}
                            className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg"
                            title="Refresh"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {events.length === 0 ? (
                        <div className="card-elevated rounded-2xl p-6 text-center text-sm text-slate-500">
                            No event packs yet. Create one for your next show or join with a teammate’s code.
                        </div>
                    ) : (
                        events.map((ev) => {
                            const active = isEventActive(ev);
                            const memberCount = membersByEvent[ev.id]?.length;
                            return (
                                <div key={ev.id} className="card-elevated rounded-2xl p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                            <CalendarDays className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{ev.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {ev.isHost ? 'Host' : 'Member'}
                                                {' · '}
                                                {active ? `Ends ${formatEventExpiry(ev.expiresAt)}` : 'Ended / expired'}
                                                {typeof memberCount === 'number' && ` · ${memberCount}/${ev.seatLimit} seats`}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                                        }`}>
                                            {active ? 'Active' : 'Closed'}
                                        </span>
                                    </div>

                                    {ev.isHost && ev.joinCode && active && (
                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-800/60 border border-brand-700">
                                            <code className="flex-1 text-sm font-mono tracking-wider text-amber-300">{ev.joinCode}</code>
                                            <button
                                                onClick={() => copyCode(ev.joinCode!)}
                                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"
                                                title="Copy join code"
                                            >
                                                {copiedCode === ev.joinCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleRotate(ev.id)}
                                                disabled={busy}
                                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400"
                                                title="Rotate join code"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => openEvent(ev)}
                                            className="flex-1 min-w-[120px] py-2 glass border border-brand-700 rounded-xl text-xs font-medium hover:bg-white/5 flex items-center justify-center gap-1.5"
                                        >
                                            <Users size={12} />
                                            Open contacts
                                        </button>
                                        {ev.isHost && active && (
                                            <button
                                                onClick={() => handleEnd(ev.id)}
                                                disabled={busy}
                                                className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                <Ban size={12} />
                                                End
                                            </button>
                                        )}
                                        {!ev.isHost && (
                                            <button
                                                onClick={() => handleLeave(ev.id)}
                                                disabled={busy}
                                                className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                <LogOut size={12} />
                                                Leave
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default Events;
