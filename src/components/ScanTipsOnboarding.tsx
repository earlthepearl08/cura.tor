import React, { useState } from 'react';
import {
    FileSpreadsheet,
    Layers,
    Lightbulb,
    AlignCenter,
    Images,
    X,
} from 'lucide-react';

export type ScanTipsVariant = 'log-sheet' | 'multi-card' | 'both';

interface Step {
    id: string;
    icon: React.ReactNode;
    accent: string;
    title: string;
    body: string;
    bullets: string[];
}

const LOG_STEPS: Step[] = [
    {
        id: 'log-frame',
        icon: <FileSpreadsheet size={22} className="text-amber-400" />,
        accent: 'bg-amber-500/20',
        title: 'Frame the whole sheet',
        body: 'Sign-in tables read best when every column and row is in view.',
        bullets: [
            'Lay the sheet flat — avoid folds and curl',
            'Use even light; watch for glare on glossy paper',
            'Keep edges parallel to the frame (square up)',
        ],
    },
    {
        id: 'log-multipage',
        icon: <Images size={22} className="text-amber-400" />,
        accent: 'bg-amber-500/20',
        title: 'Multi-page sheets',
        body: 'Long guest lists often span several pages — capture them as one batch.',
        bullets: [
            'Gallery: select multiple photos at once',
            'Or scan one page, then use Add More Sheets',
            'Same lighting and angle across pages helps consistency',
        ],
    },
];

const MULTI_STEPS: Step[] = [
    {
        id: 'multi-layout',
        icon: <Layers size={22} className="text-pink-400" />,
        accent: 'bg-pink-500/20',
        title: 'Lay out the cards',
        body: 'Spread cards so each one is fully visible — Cura.Tor splits them for you.',
        bullets: [
            'Leave a clear gap between cards (no overlap)',
            'All face-up and right-side up',
            'Even lighting across the whole photo',
            'Best with 2–8 cards per shot',
        ],
    },
];

function stepsFor(variant: ScanTipsVariant): Step[] {
    if (variant === 'log-sheet') return LOG_STEPS;
    if (variant === 'multi-card') return MULTI_STEPS;
    return [...LOG_STEPS, ...MULTI_STEPS];
}

interface ScanTipsOnboardingProps {
    /** Which tips to show. Default covers both differentiators. */
    variant?: ScanTipsVariant;
    onDismiss: () => void;
}

const ScanTipsOnboarding: React.FC<ScanTipsOnboardingProps> = ({
    variant = 'both',
    onDismiss,
}) => {
    const steps = stepsFor(variant);
    const [index, setIndex] = useState(0);
    const step = steps[index];
    const isLast = index >= steps.length - 1;

    const next = () => {
        if (isLast) onDismiss();
        else setIndex(i => i + 1);
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-tips-title"
            onClick={onDismiss}
        >
            <div
                className="bg-brand-900 rounded-2xl p-6 max-w-sm w-full border border-brand-800 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${step.accent}`}>
                            {step.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">
                                Scan tips · {index + 1}/{steps.length}
                            </p>
                            <h3 id="scan-tips-title" className="text-lg font-bold text-slate-100 leading-tight">
                                {step.title}
                            </h3>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="p-2 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors text-slate-400"
                        aria-label="Close tips"
                    >
                        <X size={18} />
                    </button>
                </div>

                <p className="text-sm text-brand-400 mb-4">{step.body}</p>

                <ul className="space-y-2 mb-5">
                    {step.bullets.map(b => (
                        <li key={b} className="flex items-start gap-2 text-sm text-slate-300">
                            {b.toLowerCase().includes('light') || b.toLowerCase().includes('glare') ? (
                                <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400/80" />
                            ) : (
                                <AlignCenter size={14} className="mt-0.5 shrink-0 text-sky-400/80" />
                            )}
                            <span>{b}</span>
                        </li>
                    ))}
                </ul>

                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 mb-4" aria-hidden>
                    {steps.map((s, i) => (
                        <span
                            key={s.id}
                            className={`h-1.5 rounded-full transition-all ${
                                i === index ? 'w-5 bg-brand-400' : 'w-1.5 bg-brand-700'
                            }`}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={next}
                    className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-bold text-sm hover:scale-[1.01] active:scale-[0.98] transition-all"
                >
                    {isLast ? 'Got it' : 'Next'}
                </button>

                {!isLast && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="w-full mt-2 py-2.5 glass rounded-xl font-medium hover:bg-white/5 transition-colors text-sm text-brand-400"
                    >
                        Skip
                    </button>
                )}
            </div>
        </div>
    );
};

export default ScanTipsOnboarding;
