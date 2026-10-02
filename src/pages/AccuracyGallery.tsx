import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    ArrowRight, BadgeCheck, Camera, FileSpreadsheet, Layers, Sparkles,
} from 'lucide-react';
import {
    ACCURACY_GALLERY_SAMPLES,
    GalleryContactFields,
    GallerySample,
    GallerySampleType,
} from '@/data/accuracyGallery';
import PageMeta, { ACCURACY_GALLERY_META } from '@/components/PageMeta';
import AccuracyReportSection from '@/components/AccuracyReportSection';

type Filter = 'all' | GallerySampleType;

const DIFFICULTY_STYLE: Record<GallerySample['difficulty'], string> = {
    easy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    medium: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    hard: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

function FieldRow({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div className="grid grid-cols-[88px_1fr] gap-2 text-xs border-b border-brand-800/60 py-1.5 last:border-0">
            <span className="text-slate-500 font-semibold uppercase tracking-wide text-[10px] pt-0.5">{label}</span>
            <span className="text-slate-200 break-words">{value}</span>
        </div>
    );
}

function ExtractedCard({ fields, rowLabel }: { fields: GalleryContactFields; rowLabel?: string }) {
    return (
        <div className="rounded-xl border border-brand-700/80 bg-brand-900/50 p-3 space-y-0.5">
            {rowLabel && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-1">{rowLabel}</p>
            )}
            <FieldRow label="Name" value={fields.name} />
            <FieldRow label="Company" value={fields.company} />
            <FieldRow label="Title" value={fields.position} />
            <FieldRow label="Phone" value={fields.phone.join(' · ')} />
            <FieldRow label="Email" value={fields.email.join(' · ')} />
            <FieldRow label="Address" value={fields.address} />
            <FieldRow label="Notes" value={fields.notes} />
        </div>
    );
}

function SampleBlock({ sample }: { sample: GallerySample }) {
    const rows = Array.isArray(sample.extracted) ? sample.extracted : [sample.extracted];
    const Icon = sample.type === 'card' ? Camera : FileSpreadsheet;

    return (
        <article
            id={sample.id}
            className="rounded-2xl border border-brand-800 bg-gradient-to-b from-brand-900/80 to-brand-950/90 overflow-hidden"
        >
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5 border-b border-brand-800/80">
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Icon size={16} className="text-sky-400 flex-shrink-0" />
                        <h3 className="text-base sm:text-lg font-bold text-slate-100">{sample.title}</h3>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${DIFFICULTY_STYLE[sample.difficulty]}`}>
                            {sample.difficulty}
                        </span>
                    </div>
                    <p className="text-sm text-brand-400">{sample.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {sample.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-brand-800 text-slate-400 border border-brand-700">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-0 lg:gap-0">
                {/* Before */}
                <div className="p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-brand-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Before · capture</p>
                        {sample.imageIsPlaceholder && (
                            <span className="text-[10px] font-semibold text-amber-400/90 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                Placeholder image
                            </span>
                        )}
                    </div>
                    <div className="rounded-xl overflow-hidden border border-brand-700 bg-black/40">
                        <img
                            src={sample.imageSrc}
                            alt={`${sample.title} sample`}
                            className="w-full h-auto object-cover"
                            loading="lazy"
                        />
                    </div>
                    <ul className="space-y-1.5">
                        {sample.highlights.map(h => (
                            <li key={h} className="flex gap-2 text-xs text-slate-400">
                                <BadgeCheck size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span>{h}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* After */}
                <div className="p-4 sm:p-5 space-y-3 bg-brand-950/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">After · structured fields</p>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {rows.map((row, i) => (
                            <ExtractedCard
                                key={`${sample.id}-${i}`}
                                fields={row}
                                rowLabel={Array.isArray(sample.extracted) ? `Row ${i + 1}` : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </article>
    );
}

const AccuracyGallery: React.FC = () => {
    const { hash, pathname } = useLocation();
    const [filter, setFilter] = useState<Filter>('all');

    const samples = useMemo(() => {
        if (filter === 'all') return ACCURACY_GALLERY_SAMPLES;
        return ACCURACY_GALLERY_SAMPLES.filter(s => s.type === filter);
    }, [filter]);

    const cardCount = ACCURACY_GALLERY_SAMPLES.filter(s => s.type === 'card').length;
    const sheetCount = ACCURACY_GALLERY_SAMPLES.filter(s => s.type === 'log-sheet').length;

    // Deep-link from Landing CTAs (e.g. /accuracy#sheet-001-ph-signin or #report)
    useEffect(() => {
        const id = hash.replace(/^#/, '');
        if (!id) return;
        const target = ACCURACY_GALLERY_SAMPLES.find((s) => s.id === id);
        if (target && filter !== 'all' && filter !== target.type) {
            setFilter('all');
            return;
        }
        requestAnimationFrame(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [hash, pathname, filter]);

    return (
        <div className="min-h-screen bg-brand-950 text-slate-200">
            <PageMeta {...ACCURACY_GALLERY_META} />
            {/* Atmosphere */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-sky-500/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-[420px] h-[320px] rounded-full bg-emerald-500/5 blur-3xl" />
            </div>

            <header className="relative z-10 border-b border-brand-800/60 sticky top-0 glass">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <Link to="/auth" className="flex items-center gap-2.5 min-w-0">
                        <img src="/logo.svg" alt="Cura.Tor" className="h-7 w-auto" />
                        <span className="font-bold text-sm sm:text-base tracking-tight text-slate-100 truncate">Cura.Tor</span>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <a href="#report" className="text-xs text-slate-500 hover:text-slate-300 hidden sm:inline">
                            Report
                        </a>
                        <Link to="/legal" className="text-xs text-slate-500 hover:text-slate-300 hidden sm:inline">Legal</Link>
                        <Link
                            to="/auth"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors"
                        >
                            Try free <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-16">
                {/* Hero */}
                <section className="pt-10 sm:pt-14 pb-8 sm:pb-10 space-y-5">
                    <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-400/90">
                        <Sparkles size={14} /> Accuracy report & samples
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-50 max-w-2xl leading-[1.1]">
                        Cura.Tor
                        <span className="block text-xl sm:text-2xl font-semibold text-slate-400 mt-2">
                            Field metrics + before/after PH cards & log sheets
                        </span>
                    </h1>
                    <p className="text-sm sm:text-base text-brand-300 max-w-xl leading-relaxed">
                        Published primary-field scores from the synthetic golden set (clearly labeled demo — not
                        live Gemini F1), plus illustrative before/after extractions you can browse without signup.
                        Swap in real photos when ready.
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <a
                            href="#report"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-200/90 hover:bg-amber-500/15 transition-colors"
                        >
                            Synthetic field report
                        </a>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-brand-800 bg-brand-900/50">
                            <Camera size={12} className="text-sky-400" /> {cardCount} gallery cards
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-brand-800 bg-brand-900/50">
                            <Layers size={12} className="text-emerald-400" /> {sheetCount} gallery sheets
                        </span>
                    </div>
                </section>

                <div className="mb-10">
                    <AccuracyReportSection />
                </div>

                <div id="samples" className="scroll-mt-20 mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                        Before / after samples
                    </h2>
                </div>

                {/* Filters */}
                <div className="flex gap-1 p-1 mb-6 rounded-xl border border-brand-800 bg-brand-900/40 w-full sm:w-auto max-w-md">
                    {([
                        { id: 'all' as const, label: 'All' },
                        { id: 'card' as const, label: 'Calling cards' },
                        { id: 'log-sheet' as const, label: 'Log sheets' },
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilter(tab.id)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                filter === tab.id
                                    ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-6">
                    {samples.map(sample => (
                        <SampleBlock key={sample.id} sample={sample} />
                    ))}
                </div>

                {/* Trust / methodology note */}
                <section className="mt-10 rounded-2xl border border-brand-800 bg-brand-900/40 p-5 sm:p-6 space-y-3">
                    <h2 className="text-sm font-bold text-slate-100">About these scores</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        The <a href="#report" className="text-sky-400 hover:text-sky-300">field metrics report</a> is a
                        synthetic/demo snapshot from <code className="text-brand-300">eval/accuracy/</code> mock eval
                        (primary fields: name, company, phone, email). It is intentionally not live Gemini F1.
                        Gallery imagery below remains placeholder until real photos are swapped via{' '}
                        <code className="text-brand-300">public/accuracy-samples/README.md</code>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <a
                            href="#report"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                        >
                            View synthetic report
                        </a>
                        <Link
                            to="/auth"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white"
                        >
                            Scan your own sheet <ArrowRight size={16} />
                        </Link>
                        <Link
                            to="/legal"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-brand-700 text-brand-300 hover:bg-white/5"
                        >
                            Privacy & terms
                        </Link>
                    </div>
                </section>
            </main>

            <footer className="relative z-10 border-t border-brand-800/50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/logo.svg" alt="" className="h-6 opacity-80" />
                        <span className="text-xs text-slate-600">Smart contact curation</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <a href="#report" className="text-slate-300 hover:text-white transition-colors">Report</a>
                        <a href="#samples" className="hover:text-slate-300 transition-colors">Samples</a>
                        <Link to="/legal" className="hover:text-slate-300 transition-colors">Legal</Link>
                        <Link to="/auth" className="hover:text-slate-300 transition-colors">Sign in</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AccuracyGallery;
