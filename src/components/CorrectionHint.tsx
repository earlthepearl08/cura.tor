import React from 'react';
import { BookMarked, Undo2, Check } from 'lucide-react';
import { CorrectionSuggestion, AppliedCorrection } from '@/types/correction';

interface SuggestionProps {
    suggestion: CorrectionSuggestion;
    onAccept: () => void;
    onDismiss: () => void;
}

/** Lightweight chip: offer a saved glossary value for an OCR field. */
export const CorrectionSuggestionChip: React.FC<SuggestionProps> = ({
    suggestion,
    onAccept,
    onDismiss,
}) => (
    <div className="mt-1.5 flex items-start gap-2 px-2.5 py-2 rounded-lg bg-sky-500/10 border border-sky-500/25">
        <BookMarked size={14} className="text-sky-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-[11px] text-sky-300 leading-snug">
                Glossary: use <span className="font-semibold text-sky-200">{suggestion.to}</span>
                {!suggestion.exact && (
                    <span className="text-sky-500"> (similar to “{suggestion.from}”)</span>
                )}
            </p>
            <div className="flex gap-2 mt-1.5">
                <button
                    type="button"
                    onClick={onAccept}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 hover:text-sky-200"
                >
                    <Check size={11} /> Use
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-400"
                >
                    Dismiss
                </button>
            </div>
        </div>
    </div>
);

interface AppliedProps {
    applied: AppliedCorrection[];
    onUndo: (field: AppliedCorrection['field']) => void;
}

/** Subtle notice when glossary values were auto-applied. */
export const CorrectionAppliedBanner: React.FC<AppliedProps> = ({ applied, onUndo }) => {
    if (applied.length === 0) return null;
    return (
        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 space-y-1.5">
            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookMarked size={12} /> Applied from glossary
            </p>
            {applied.map(a => (
                <div key={a.field} className="flex items-center justify-between gap-2 text-xs text-sky-200/90">
                    <span className="truncate">
                        <span className="text-slate-500 capitalize">{a.field}:</span>{' '}
                        <span className="line-through text-slate-500">{a.from}</span>
                        {' → '}
                        <span className="font-medium">{a.to}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => onUndo(a.field)}
                        className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300"
                    >
                        <Undo2 size={11} /> Undo
                    </button>
                </div>
            ))}
        </div>
    );
};
