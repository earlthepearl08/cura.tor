import { useState } from 'react';
import { Check, Edit2 } from 'lucide-react';
import { ScanType, generateBatchName } from '@/types/batch';

interface BatchNamingModalProps {
    scanType: ScanType;
    totalContacts: number;
    successCount: number;
    errorCount: number;
    timestamp: number;
    onSave: (name: string) => void;
    onSkip: () => void;
}

const BatchNamingModal: React.FC<BatchNamingModalProps> = ({
    scanType,
    totalContacts,
    successCount,
    errorCount,
    timestamp,
    onSave,
    onSkip,
}) => {
    const defaultName = generateBatchName(scanType, timestamp, totalContacts);
    const [batchName, setBatchName] = useState(defaultName);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = () => {
        onSave(batchName.trim() || defaultName);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md glass border border-brand-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-slide-up">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 mx-auto bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                        <Check className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">Scan Complete!</h2>
                </div>

                {/* Stats */}
                <div className="glass border border-brand-800 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <p className="text-2xl font-bold text-brand-400">{totalContacts}</p>
                            <p className="text-xs text-slate-500">Total</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
                            <p className="text-xs text-slate-500">Success</p>
                        </div>
                        {errorCount > 0 && (
                            <div>
                                <p className="text-2xl font-bold text-amber-400">{errorCount}</p>
                                <p className="text-xs text-slate-500">Need Review</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Batch Name Input */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-brand-400 uppercase tracking-wider">
                        Name this batch (optional)
                    </label>
                    <div className="relative">
                        {isEditing ? (
                            <input
                                type="text"
                                value={batchName}
                                onChange={(e) => setBatchName(e.target.value)}
                                onBlur={() => setIsEditing(false)}
                                autoFocus
                                placeholder={defaultName}
                                className="w-full glass border border-brand-700 rounded-xl py-3 px-4 pr-10 text-sm focus:ring-2 focus:ring-brand-500"
                            />
                        ) : (
                            <div
                                onClick={() => setIsEditing(true)}
                                className="w-full glass border border-brand-700 rounded-xl py-3 px-4 pr-10 text-sm cursor-pointer hover:border-brand-600 transition-colors"
                            >
                                {batchName || defaultName}
                            </div>
                        )}
                        <button
                            onClick={() => setIsEditing(true)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Edit2 size={14} className="text-brand-500" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">
                        This helps you identify where contacts came from later.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onSkip}
                        className="flex-1 py-3 glass border border-brand-800 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-bold transition-colors active:scale-95"
                    >
                        Save Batch
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatchNamingModal;
