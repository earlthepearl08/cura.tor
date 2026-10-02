import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, FlaskConical } from 'lucide-react';
import {
    formatPct,
    PUBLISHED_ACCURACY_REPORT,
} from '@/data/accuracyReport';

/**
 * Public accuracy metrics subsection — synthetic golden-set scores only.
 * Mounted on /accuracy (and deep-linked as #report).
 */
export function AccuracyReportSection() {
    const report = PUBLISHED_ACCURACY_REPORT;
    const isSynthetic = report.status === 'synthetic-demo';

    return (
        <section
            id="report"
            aria-labelledby="accuracy-report-heading"
            className="scroll-mt-20 rounded-2xl border border-brand-800 bg-gradient-to-b from-brand-900/90 to-brand-950/95 overflow-hidden"
        >
            <div className="p-5 sm:p-6 border-b border-brand-800/80 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <BarChart3 size={16} className="text-sky-400" />
                    <h2 id="accuracy-report-heading" className="text-base sm:text-lg font-bold text-slate-100">
                        Published field metrics
                    </h2>
                    <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                            isSynthetic
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}
                    >
                        {report.statusLabel}
                    </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
                    {report.statusDetail}
                </p>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
                {/* Live F1 honesty callout */}
                <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4">
                    <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-amber-100">{report.liveGeminiF1.label}</p>
                        <p className="text-xs text-amber-200/80 leading-relaxed">{report.liveGeminiF1.detail}</p>
                    </div>
                </div>

                {/* Coverage */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat
                        label="Card fixtures"
                        value={`${report.coverage.cards}/${report.coverage.targetCards}`}
                        hint="synthetic golden set"
                    />
                    <Stat
                        label="Log sheets"
                        value={`${report.coverage.logSheets}/${report.coverage.targetSheets}`}
                        hint="synthetic PH sheets"
                    />
                    <Stat
                        label="Cards · primary"
                        value={formatPct(report.cardsPrimaryAccuracy)}
                        hint="name/company/phone/email"
                        synthetic
                    />
                    <Stat
                        label="Sheets · primary"
                        value={formatPct(report.logSheetsPrimaryAccuracy)}
                        hint="avg row primary"
                        synthetic
                    />
                </div>

                {/* Per-field bars */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <FlaskConical size={14} className="text-sky-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Primary fields · synthetic mock eval
                        </h3>
                    </div>
                    <ul className="space-y-2.5">
                        {report.primaryFields.map((f) => (
                            <li key={f.field}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-300">{f.label}</span>
                                    <span className="tabular-nums text-slate-400">
                                        {formatPct(f.score)}
                                        <span className="text-slate-600 ml-1.5">demo</span>
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-brand-900 border border-brand-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-sky-500/70"
                                        style={{ width: `${Math.min(100, Math.max(0, f.score * 100))}%` }}
                                        role="progressbar"
                                        aria-valuenow={Math.round(f.score * 100)}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-label={`${f.label} synthetic score`}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-wrap items-start gap-2 text-[11px] text-slate-500 leading-relaxed border-t border-brand-800/60 pt-4">
                    <CheckCircle2 size={12} className="text-emerald-500/80 mt-0.5 flex-shrink-0" />
                    <p>
                        Source: <code className="text-brand-400">{report.source.command}</code>
                        {' · '}mode <code className="text-brand-400">{report.source.mode}</code>
                        {' · '}snapshot {new Date(report.generatedAt).toISOString().slice(0, 10)}
                        {' · '}{report.source.prNote}
                        {' · '}Samples gallery below;{' '}
                        <Link to="/accuracy#samples" className="text-sky-400/90 hover:text-sky-300 underline-offset-2 hover:underline">
                            jump to before/after
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </section>
    );
}

function Stat({
    label,
    value,
    hint,
    synthetic,
}: {
    label: string;
    value: string;
    hint: string;
    synthetic?: boolean;
}) {
    return (
        <div className="rounded-xl border border-brand-800 bg-brand-950/60 px-3 py-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">
                {value}
                {synthetic && (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase text-amber-400/90">demo</span>
                )}
            </p>
            <p className="text-[10px] text-slate-600">{hint}</p>
        </div>
    );
}

export default AccuracyReportSection;
