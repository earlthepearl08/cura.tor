import { useState } from 'react';
import { Headphones, Mail, Copy, Check, X, ExternalLink } from 'lucide-react';
import {
    SUPPORT_EMAIL,
    PRIORITY_SUPPORT_SLA,
    STANDARD_SUPPORT_NOTE,
    SUPPORT_CATEGORIES,
    SupportCategory,
    buildSupportMailto,
} from '@/config/support';

interface ContactSupportModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string | null;
    userName?: string | null;
    tier?: string | null;
    /** Pro / Enterprise — priority queue labeling */
    priority?: boolean;
}

const ContactSupportModal: React.FC<ContactSupportModalProps> = ({
    isOpen,
    onClose,
    userEmail,
    userName,
    tier,
    priority = false,
}) => {
    const [category, setCategory] = useState<SupportCategory>('ocr');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const mailto = buildSupportMailto({
        category,
        subject,
        message,
        userEmail,
        userName,
        tier,
        priority,
    });

    const openMail = () => {
        window.location.href = mailto;
    };

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(SUPPORT_EMAIL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older WebViews
            const ta = document.createElement('textarea');
            ta.value = SUPPORT_EMAIL;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md glass border border-brand-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            priority ? 'bg-emerald-500/20' : 'bg-sky-500/20'
                        }`}>
                            <Headphones className={`w-5 h-5 ${priority ? 'text-emerald-400' : 'text-sky-400'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">
                                {priority ? 'Priority support' : 'Contact support'}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                {priority ? PRIORITY_SUPPORT_SLA : STANDARD_SUPPORT_NOTE}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-slate-400"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-brand-900/70 border border-brand-800">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email</p>
                        <p className="text-sm text-sky-300 truncate">{SUPPORT_EMAIL}</p>
                    </div>
                    <button
                        type="button"
                        onClick={copyAddress}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-brand-700 text-brand-300 hover:bg-white/5"
                    >
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Category</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value as SupportCategory)}
                            className="mt-1 w-full glass border border-brand-800 rounded-xl py-2.5 px-3 text-sm bg-brand-900 focus:ring-1 focus:ring-brand-500"
                        >
                            {SUPPORT_CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Short summary"
                            className="mt-1 w-full glass border border-brand-800 rounded-xl py-2.5 px-3 text-sm focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={4}
                            placeholder="What happened? Include event name / device if relevant."
                            className="mt-1 w-full glass border border-brand-800 rounded-xl py-2.5 px-3 text-sm resize-none focus:ring-1 focus:ring-brand-500"
                        />
                    </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                    Opens your email app with a pre-filled message to{' '}
                    <span className="text-slate-400">{SUPPORT_EMAIL}</span>. No in-app ticket system yet —
                    this is the handoff to the shared inbox.
                </p>

                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={openMail}
                        className={`w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                            priority
                                ? 'bg-emerald-500 hover:bg-emerald-400'
                                : 'bg-sky-500 hover:bg-sky-400'
                        }`}
                    >
                        <Mail size={16} />
                        Open email app
                    </button>
                    <a
                        href={mailto}
                        className="w-full py-2.5 rounded-xl font-medium text-sm text-brand-300 bg-brand-800 hover:bg-brand-700 flex items-center justify-center gap-2"
                    >
                        <ExternalLink size={14} />
                        Or use mailto link
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ContactSupportModal;
