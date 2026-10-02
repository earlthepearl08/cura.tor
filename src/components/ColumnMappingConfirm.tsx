import { useState } from 'react';
import { Columns3, AlertTriangle, Check, SkipForward } from 'lucide-react';
import {
    LOG_SHEET_FIELD_KEYS,
    LOG_SHEET_FIELD_LABELS,
    LogSheetColumnMapping,
    LogSheetFieldKey,
    LogSheetParseMeta,
} from '@/types/logSheet';

interface ColumnMappingConfirmProps {
    meta: LogSheetParseMeta;
    sampleEntry?: {
        name: string;
        company: string;
        position: string;
        phone: string[];
        email: string[];
        address: string;
        notes: string;
    } | null;
    onConfirm: (mapping: LogSheetColumnMapping) => void;
    onSkip: () => void;
}

const ColumnMappingConfirm: React.FC<ColumnMappingConfirmProps> = ({
    meta,
    sampleEntry,
    onConfirm,
    onSkip,
}) => {
    const [mapping, setMapping] = useState<LogSheetColumnMapping>({ ...meta.suggestedMapping });

    const headerOptions = meta.detectedHeaders.length > 0
        ? meta.detectedHeaders
        : Object.values(meta.suggestedMapping).filter(Boolean) as string[];

    const uniqueHeaders = Array.from(new Set(headerOptions));

    const updateField = (field: LogSheetFieldKey, header: string) => {
        setMapping(prev => {
            const next = { ...prev };
            if (!header) {
                delete next[field];
            } else {
                next[field] = header;
            }
            return next;
        });
    };

    const sampleFor = (field: LogSheetFieldKey): string => {
        if (!sampleEntry) return '';
        const v = sampleEntry[field];
        if (Array.isArray(v)) return v.join(', ');
        return v || '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md glass border border-brand-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-slide-up">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 mx-auto bg-amber-500/20 rounded-2xl flex items-center justify-center">
                        <Columns3 className="w-6 h-6 text-amber-400" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-100">Confirm column mapping</h2>
                    <p className="text-xs text-brand-400 leading-relaxed">
                        Headers look ambiguous. Match each sheet column to a contact field before import.
                        Full event templates come later — this confirms the current sheet only.
                    </p>
                </div>

                {meta.ambiguityReasons.length > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <ul className="text-[11px] text-amber-200/90 space-y-1">
                            {meta.ambiguityReasons.slice(0, 3).map((r, i) => (
                                <li key={i}>{r}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {uniqueHeaders.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {uniqueHeaders.map(h => (
                            <span
                                key={h}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-brand-800/80 text-brand-300 border border-brand-700"
                            >
                                {h}
                            </span>
                        ))}
                    </div>
                )}

                <div className="space-y-2.5">
                    {LOG_SHEET_FIELD_KEYS.map(field => (
                        <div key={field} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[11px] font-semibold text-slate-300">
                                    {LOG_SHEET_FIELD_LABELS[field]}
                                </label>
                                {sampleFor(field) && (
                                    <span className="text-[10px] text-slate-500 truncate max-w-[55%]" title={sampleFor(field)}>
                                        e.g. {sampleFor(field)}
                                    </span>
                                )}
                            </div>
                            <select
                                value={mapping[field] || ''}
                                onChange={e => updateField(field, e.target.value)}
                                className="w-full glass border border-brand-800 rounded-xl py-2.5 px-3 text-sm bg-brand-900 focus:ring-1 focus:ring-brand-500"
                            >
                                <option value="">— Not used —</option>
                                {uniqueHeaders.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                <div className="space-y-2 pt-1">
                    <button
                        onClick={() => onConfirm(mapping)}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <Check size={16} />
                        Confirm mapping
                    </button>
                    <button
                        onClick={onSkip}
                        className="w-full py-2.5 bg-brand-800 hover:bg-brand-700 rounded-xl font-medium text-sm text-brand-300 flex items-center justify-center gap-2"
                    >
                        <SkipForward size={14} />
                        Keep suggested & continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ColumnMappingConfirm;
