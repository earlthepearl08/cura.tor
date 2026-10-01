import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Check, X, ArrowRight, FileSpreadsheet, Layers, ScanLine,
    Cloud, Download, Users, ShieldCheck, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PageMeta, { LANDING_META } from '@/components/PageMeta';
import { STRIPE_PRICES } from '@/services/stripe';
import { TIER_LIMITS } from '@/types/user';

type BillingInterval = 'monthly' | 'yearly';

const FEATURE_ROWS: {
    label: string;
    free: string | boolean;
    pioneer: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
}[] = [
    {
        label: 'Scans',
        free: `${TIER_LIMITS.free.scansPerMonth}/mo`,
        pioneer: 'Unlimited',
        pro: 'Unlimited',
        enterprise: 'Unlimited',
    },
    {
        label: 'Contact storage',
        free: String(TIER_LIMITS.free.contactStorage),
        pioneer: String(TIER_LIMITS.early_access.contactStorage),
        pro: 'Unlimited',
        enterprise: `${TIER_LIMITS.enterprise.contactStorage} personal`,
    },
    {
        label: 'Single card & QR scan',
        free: true,
        pioneer: true,
        pro: true,
        enterprise: true,
    },
    {
        label: 'Manual entry',
        free: true,
        pioneer: true,
        pro: true,
        enterprise: true,
    },
    {
        label: 'vCard / CSV / Excel export',
        free: false,
        pioneer: true,
        pro: true,
        enterprise: true,
    },
    {
        label: 'Google Drive sync',
        free: TIER_LIMITS.free.googleDriveSync,
        pioneer: TIER_LIMITS.early_access.googleDriveSync,
        pro: TIER_LIMITS.pro.googleDriveSync,
        enterprise: TIER_LIMITS.enterprise.googleDriveSync,
    },
    {
        label: 'Multi-Card Scan',
        free: TIER_LIMITS.free.bulkScan,
        pioneer: TIER_LIMITS.early_access.bulkScan,
        pro: TIER_LIMITS.pro.bulkScan,
        enterprise: TIER_LIMITS.enterprise.bulkScan,
    },
    {
        label: 'Log Sheet Scan',
        free: TIER_LIMITS.free.bulkScan,
        pioneer: TIER_LIMITS.early_access.bulkScan,
        pro: TIER_LIMITS.pro.bulkScan,
        enterprise: TIER_LIMITS.enterprise.bulkScan,
    },
    {
        label: 'Shared team workspace',
        free: false,
        pioneer: false,
        pro: false,
        enterprise: true,
    },
];

function CellValue({ value }: { value: string | boolean }) {
    if (typeof value === 'boolean') {
        return value
            ? <Check size={16} className="text-emerald-400 mx-auto" aria-label="Included" />
            : <X size={16} className="text-slate-600 mx-auto" aria-label="Not included" />;
    }
    return <span className="text-xs sm:text-sm text-slate-300 font-medium">{value}</span>;
}

const Landing: React.FC = () => {
    const { user, isLoading } = useAuth();
    const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
    const isSignedIn = !isLoading && !!user;

    const pioneerPrice = billingInterval === 'monthly'
        ? STRIPE_PRICES.pioneer.monthly
        : STRIPE_PRICES.pioneer.yearly;
    const proPrice = billingInterval === 'monthly'
        ? STRIPE_PRICES.pro.monthly
        : STRIPE_PRICES.pro.yearly;
    const period = billingInterval === 'monthly' ? 'mo' : 'yr';

    return (
        <div className="min-h-screen bg-brand-950 text-slate-200">
            <PageMeta {...LANDING_META} />
            {/* Nav */}
            <header className="sticky top-0 z-20 glass border-b border-brand-800/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <a href="#top" className="flex items-center gap-2" aria-label="Cura.tor home">
                        <img src="/logo.svg" alt="Cura.tor" className="h-7" />
                    </a>
                    <nav className="flex items-center gap-2 sm:gap-3">
                        <a
                            href="#pricing"
                            className="hidden sm:inline text-sm text-slate-400 hover:text-white transition-colors px-2"
                        >
                            Pricing
                        </a>
                        {isSignedIn ? (
                            <Link
                                to="/app"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-brand-950 text-sm font-bold transition-colors"
                            >
                                Open app
                                <ArrowRight size={14} />
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to="/auth"
                                    className="text-sm text-slate-300 hover:text-white transition-colors px-2 py-2"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    to="/auth"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-brand-950 text-sm font-bold transition-colors"
                                >
                                    Get started
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* Hero */}
            <section
                id="top"
                className="relative overflow-hidden border-b border-brand-800/40"
            >
                <div
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden
                    style={{
                        background:
                            'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(14,165,233,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(2,132,199,0.12), transparent 50%)',
                    }}
                />
                {/* Scan-line motif */}
                <div
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent animate-pulse-slow"
                    aria-hidden
                />

                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28">
                    <div className="max-w-2xl landing-fade-up">
                        <img src="/logo.svg" alt="Cura.tor" className="h-10 sm:h-12 mb-8" />

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.05]">
                            Log sheets and cards,{' '}
                            <span className="bg-gradient-to-r from-sky-300 to-sky-500 bg-clip-text text-transparent">
                                read in one pass
                            </span>
                        </h1>

                        <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
                            Cura.tor turns trade-show sign-in sheets and stacks of calling cards into
                            structured contacts — ready to review, claim, and export.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            {isSignedIn ? (
                                <Link
                                    to="/app"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-brand-950 font-bold text-sm transition-all active:scale-[0.98]"
                                >
                                    Continue to app
                                    <ArrowRight size={16} />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/auth"
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-brand-950 font-bold text-sm transition-all active:scale-[0.98]"
                                    >
                                        Start free
                                        <ArrowRight size={16} />
                                    </Link>
                                    <a
                                        href="#pricing"
                                        className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl glass text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                    >
                                        See pricing
                                        <ChevronRight size={14} />
                                    </a>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Dominant visual: stylized scan frame */}
                    <div
                        className="mt-14 sm:mt-16 relative max-w-3xl landing-fade-up-delay"
                        aria-hidden
                    >
                        <div className="relative rounded-2xl border border-sky-500/25 bg-brand-900/60 overflow-hidden aspect-[16/9] sm:aspect-[2.2/1]">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
                            {/* Fake log sheet rows */}
                            <div className="absolute inset-6 sm:inset-10 flex flex-col gap-2.5 justify-center">
                                {['Name', 'Company', 'Phone', 'Email'].map((h, i) => (
                                    <div key={h} className="flex gap-2 sm:gap-3 items-center opacity-90" style={{ animationDelay: `${i * 120}ms` }}>
                                        <div className="w-14 sm:w-20 shrink-0 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-400/70">{h}</div>
                                        <div className="flex-1 h-7 sm:h-8 rounded-md bg-brand-800/80 border border-brand-700/60 relative overflow-hidden">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500/25 to-transparent landing-fill-bar"
                                                style={{ width: `${55 + i * 10}%`, animationDelay: `${0.4 + i * 0.15}s` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Scanning beam */}
                            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)] landing-scan-beam" />
                            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">Reading sheet</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Product story: Log sheets */}
            <section className="border-b border-brand-800/40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
                    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 text-sky-400 mb-4">
                                <FileSpreadsheet size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Log sheet reading</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                Capture an entire sign-in sheet in one photo
                            </h2>
                            <p className="mt-4 text-slate-400 leading-relaxed">
                                Point Cura.tor at a booth log or handwritten visitor list. It extracts rows
                                into editable contacts, flags likely duplicates, and lets you import only
                                the leads you want — built for trade shows, not desk scanners.
                            </p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    'Table-aware OCR tuned for event sheets',
                                    'Inline review before anything is saved',
                                    'Multi-page batch for long guest lists',
                                ].map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                                        <Check size={16} className="text-sky-400 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-5 text-xs text-slate-500">
                                Log Sheet Scan is included on <span className="text-emerald-400 font-medium">Pro</span> and{' '}
                                <span className="text-sky-400 font-medium">Enterprise</span>.
                            </p>
                        </div>
                        <div className="relative rounded-2xl border border-brand-700/60 bg-brand-900/50 p-5 sm:p-6">
                            <div className="space-y-2 font-mono text-[11px] sm:text-xs text-slate-400">
                                <div className="grid grid-cols-4 gap-2 pb-2 border-b border-brand-700 text-sky-400/80 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
                                    <span>Name</span><span>Company</span><span>Phone</span><span>Email</span>
                                </div>
                                {[
                                    ['M. Santos', 'Kinmo PW', '0917…', 'm@…'],
                                    ['A. Reyes', 'Northwind', '0918…', 'a@…'],
                                    ['J. Cruz', 'Booth 12', '0920…', 'j@…'],
                                ].map((row) => (
                                    <div key={row[0]} className="grid grid-cols-4 gap-2 py-1.5 border-b border-brand-800/50">
                                        {row.map((cell) => <span key={cell} className="truncate">{cell}</span>)}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                                <Check size={14} />
                                3 contacts ready to import
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Product story: Calling cards */}
            <section className="border-b border-brand-800/40 bg-[radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.06),transparent_50%)]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
                    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="order-2 lg:order-1 relative">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: ScanLine, title: 'Single card', detail: 'Camera or upload — fields parsed in seconds' },
                                    { icon: Layers, title: 'Multi-card', detail: 'One photo of several cards, split automatically' },
                                    { icon: Download, title: 'Export', detail: 'vCard, CSV, or Excel when your plan allows' },
                                    { icon: Cloud, title: 'Drive sync', detail: 'Optional backup to Google Drive App Data' },
                                ].map(({ icon: Icon, title, detail }) => (
                                    <div key={title} className="rounded-xl border border-brand-700/50 bg-brand-900/40 p-4">
                                        <Icon size={18} className="text-sky-400 mb-2" />
                                        <p className="text-sm font-semibold text-white">{title}</p>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <div className="inline-flex items-center gap-2 text-sky-400 mb-4">
                                <Layers size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">Calling-card reading</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                From crumpled cards to clean contacts
                            </h2>
                            <p className="mt-4 text-slate-400 leading-relaxed">
                                Scan one card at a time, or lay several on a table and capture them together.
                                Cura.tor splits multi-card shots, parses names, phones, and emails, then keeps
                                everything on-device until you choose to sync or export.
                            </p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    'Works with camera, gallery, QR / vCard, or manual entry',
                                    'Multi-Card Scan for booth hauls (Pro+)',
                                    'Duplicate detection before you clutter your list',
                                ].map((item) => (
                                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                                        <Check size={16} className="text-sky-400 shrink-0 mt-0.5" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="border-b border-brand-800/40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            Clear pricing for every stage
                        </h2>
                        <p className="mt-3 text-slate-400 text-sm sm:text-base">
                            Limits match what the app enforces today — no surprise gates after signup.
                        </p>

                        <div className="mt-6 inline-flex items-center gap-3">
                            <span className={`text-sm transition-colors ${billingInterval === 'monthly' ? 'font-medium text-slate-200' : 'text-slate-500'}`}>
                                Monthly
                            </span>
                            <button
                                type="button"
                                onClick={() => setBillingInterval((b) => (b === 'monthly' ? 'yearly' : 'monthly'))}
                                className={`w-12 h-7 rounded-full relative transition-colors ${
                                    billingInterval === 'yearly' ? 'bg-emerald-500' : 'bg-brand-700'
                                }`}
                                aria-label="Toggle yearly billing"
                            >
                                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-transform ${
                                    billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                            </button>
                            <span className={`text-sm transition-colors ${billingInterval === 'yearly' ? 'font-medium text-slate-200' : 'text-slate-500'}`}>
                                Yearly
                                {billingInterval === 'yearly' && (
                                    <span className="ml-1 text-[10px] text-emerald-400 font-bold">SAVE ~17%</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Plan summary cards */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
                        {/* Free */}
                        <div className="rounded-2xl border border-brand-700/60 bg-brand-900/40 p-5 flex flex-col">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Free</p>
                            <p className="mt-2 text-2xl font-bold text-white">$0</p>
                            <p className="text-xs text-slate-500 mt-1">Try the pipeline</p>
                            <ul className="mt-4 space-y-2 flex-1 text-xs text-slate-400">
                                <li className="flex gap-2"><Check size={12} className="text-slate-500 shrink-0 mt-0.5" />{TIER_LIMITS.free.scansPerMonth} scans / month</li>
                                <li className="flex gap-2"><Check size={12} className="text-slate-500 shrink-0 mt-0.5" />Up to {TIER_LIMITS.free.contactStorage} contacts</li>
                                <li className="flex gap-2"><Check size={12} className="text-slate-500 shrink-0 mt-0.5" />Card, QR & manual entry</li>
                            </ul>
                            <Link
                                to={isSignedIn ? '/app' : '/auth'}
                                className="mt-5 block text-center py-2.5 rounded-xl glass border border-brand-700 text-sm font-semibold hover:bg-white/5 transition-colors"
                            >
                                {isSignedIn ? 'Open app' : 'Create account'}
                            </Link>
                        </div>

                        {/* Pioneer */}
                        <div className="rounded-2xl border border-amber-500/40 bg-brand-900/40 p-5 flex flex-col">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pioneer</p>
                            <p className="mt-2 text-2xl font-bold text-white">
                                ${pioneerPrice.amount}
                                <span className="text-xs font-normal text-slate-500">/{period}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Unlimited scans + export</p>
                            <ul className="mt-4 space-y-2 flex-1 text-xs text-slate-400">
                                <li className="flex gap-2"><Check size={12} className="text-amber-400 shrink-0 mt-0.5" />Unlimited scans</li>
                                <li className="flex gap-2"><Check size={12} className="text-amber-400 shrink-0 mt-0.5" />Up to {TIER_LIMITS.early_access.contactStorage} contacts</li>
                                <li className="flex gap-2"><Check size={12} className="text-amber-400 shrink-0 mt-0.5" />vCard, CSV, Excel & Drive</li>
                            </ul>
                            <Link
                                to={isSignedIn ? '/settings' : '/auth'}
                                className="mt-5 block text-center py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-brand-950 text-sm font-bold transition-colors"
                            >
                                {isSignedIn ? 'Manage in Settings' : 'Get Pioneer'}
                            </Link>
                        </div>

                        {/* Pro */}
                        <div className="rounded-2xl border border-emerald-500/50 bg-brand-900/50 p-5 flex flex-col relative">
                            <span className="absolute -top-2.5 right-4 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-brand-950">
                                BEST VALUE
                            </span>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pro</p>
                            <p className="mt-2 text-2xl font-bold text-white">
                                ${proPrice.amount}
                                <span className="text-xs font-normal text-slate-500">/{period}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Log sheets & multi-card</p>
                            <ul className="mt-4 space-y-2 flex-1 text-xs text-slate-400">
                                <li className="flex gap-2"><Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />Everything in Pioneer</li>
                                <li className="flex gap-2"><Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />Unlimited contacts</li>
                                <li className="flex gap-2"><Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />Multi-Card & Log Sheet</li>
                            </ul>
                            <Link
                                to={isSignedIn ? '/settings' : '/auth'}
                                className="mt-5 block text-center py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-brand-950 text-sm font-bold transition-colors"
                            >
                                {isSignedIn ? 'Manage in Settings' : 'Get Pro'}
                            </Link>
                        </div>

                        {/* Enterprise */}
                        <div className="rounded-2xl border border-sky-500/40 bg-brand-900/40 p-5 flex flex-col">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Enterprise</p>
                            <p className="mt-2 text-2xl font-bold text-white">Custom</p>
                            <p className="text-xs text-slate-500 mt-1">Shared team workspace</p>
                            <ul className="mt-4 space-y-2 flex-1 text-xs text-slate-400">
                                <li className="flex gap-2"><Check size={12} className="text-sky-400 shrink-0 mt-0.5" />Pro scan features</li>
                                <li className="flex gap-2"><Check size={12} className="text-sky-400 shrink-0 mt-0.5" />Org contacts & claims</li>
                                <li className="flex gap-2"><Check size={12} className="text-sky-400 shrink-0 mt-0.5" />Admin invites & seats</li>
                            </ul>
                            <Link
                                to={isSignedIn ? '/settings' : '/auth'}
                                className="mt-5 block text-center py-2.5 rounded-xl glass border border-sky-500/30 text-sky-400 text-sm font-semibold hover:bg-sky-500/10 transition-colors"
                            >
                                {isSignedIn ? 'Request in Settings' : 'Sign in to request'}
                            </Link>
                        </div>
                    </div>

                    {/* Feature matrix */}
                    <div className="overflow-x-auto rounded-2xl border border-brand-700/60">
                        <table className="w-full min-w-[640px] text-left border-collapse">
                            <thead>
                                <tr className="bg-brand-900/80 border-b border-brand-700/60">
                                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 w-[32%]">Feature</th>
                                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Free</th>
                                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-amber-400 text-center">Pioneer</th>
                                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-emerald-400 text-center">Pro</th>
                                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-sky-400 text-center">Enterprise</th>
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURE_ROWS.map((row, i) => (
                                    <tr
                                        key={row.label}
                                        className={i % 2 === 0 ? 'bg-brand-950/40' : 'bg-brand-900/30'}
                                    >
                                        <td className="px-4 py-3 text-sm text-slate-300">{row.label}</td>
                                        <td className="px-3 py-3 text-center"><CellValue value={row.free} /></td>
                                        <td className="px-3 py-3 text-center"><CellValue value={row.pioneer} /></td>
                                        <td className="px-3 py-3 text-center"><CellValue value={row.pro} /></td>
                                        <td className="px-3 py-3 text-center"><CellValue value={row.enterprise} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-4 text-center text-xs text-slate-600">
                        Enterprise personal workspace stores up to {TIER_LIMITS.enterprise.contactStorage} contacts;
                        shared team storage is the primary workspace for orgs.
                    </p>
                </div>
            </section>

            {/* Closing CTA */}
            <section className="relative overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none"
                    aria-hidden
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(14,165,233,0.12), transparent 60%)',
                    }}
                />
                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
                    <Users className="w-8 h-8 text-sky-400 mx-auto mb-4" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Ready for the next booth day?
                    </h2>
                    <p className="mt-3 text-slate-400">
                        Sign up free — upgrade when you need unlimited scans, exports, or log-sheet reading.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link
                            to={isSignedIn ? '/app' : '/auth'}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-brand-950 font-bold text-sm transition-colors"
                        >
                            {isSignedIn ? 'Open Cura.tor' : 'Get started free'}
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <p className="mt-8 text-xs text-slate-600 flex items-center justify-center gap-1.5">
                        <ShieldCheck size={12} />
                        Contacts stay on your device by default. Optional Drive sync uses App Data.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-brand-800/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/logo.svg" alt="Cura.tor" className="h-6 opacity-80" />
                        <span className="text-xs text-slate-600">Smart contact curation</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
                        <Link to="/legal" className="hover:text-slate-300 transition-colors">Terms & Privacy</Link>
                        <Link to="/auth" className="hover:text-slate-300 transition-colors">
                            {isSignedIn ? 'Account' : 'Sign in'}
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
