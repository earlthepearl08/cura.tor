import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowRight } from 'lucide-react';

export default function RedeemTeamCodeCard() {
    const navigate = useNavigate();
    const [code, setCode] = useState('');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const normalized = code.trim().toUpperCase();
        if (!normalized) return;
        // AcceptInvite page handles the actual redemption + seat + state update
        navigate(`/invite/${encodeURIComponent(normalized)}`);
    };

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-1">Have a team code?</p>
            <form onSubmit={submit} className="card-elevated rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">Join a team</p>
                        <p className="text-xs text-slate-500">Paste the code your admin sent you</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="ABCD-EFGH"
                        autoCapitalize="characters"
                        autoComplete="off"
                        className="flex-1 px-3 py-2 bg-brand-800 rounded-xl text-sm border border-brand-700 focus:border-emerald-500 outline-none font-mono uppercase tracking-wider"
                    />
                    <button
                        type="submit"
                        disabled={!code.trim()}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold flex items-center gap-1 transition-colors"
                    >
                        Join <ArrowRight size={14} />
                    </button>
                </div>
            </form>
        </div>
    );
}
