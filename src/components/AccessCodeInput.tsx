import React, { useState } from 'react';
import { Ticket, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AccessCodeInput: React.FC = () => {
    const { redeemAccessCode } = useAuth();
    const [code, setCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleRedeem = async () => {
        if (!code.trim()) return;
        setIsRedeeming(true);
        setResult(null);
        const res = await redeemAccessCode(code.trim());
        setResult(res);
        setIsRedeeming(false);
        if (res.success) setCode('');
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Ticket className="absolute left-3 top-3 text-brand-500" size={18} />
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
                        placeholder="Enter access code"
                        className="w-full glass border border-brand-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 focus:ring-brand-500 uppercase"
                        onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                    />
                </div>
                <button
                    onClick={handleRedeem}
                    disabled={isRedeeming || !code.trim()}
                    className="px-5 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] transition-all"
                >
                    {isRedeeming ? <Loader2 className="animate-spin" size={18} /> : 'Redeem'}
                </button>
            </div>
            {result && (
                <div className={`flex items-start gap-2 text-sm ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.success ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
                    <span>{result.message}</span>
                </div>
            )}
        </div>
    );
};

export default AccessCodeInput;
