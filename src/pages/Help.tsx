import React, { useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Camera, Layers, FileSpreadsheet } from 'lucide-react';
import { HELP_CLIPS, HelpClipId, getHelpClip } from '@/config/helpVideos';
import HelpVideoCard from '@/components/HelpVideoCard';

const QUICK_LINKS: { id: HelpClipId; icon: React.ReactNode; label: string }[] = [
    { id: 'single-card', icon: <Camera size={14} />, label: 'Single card' },
    { id: 'multi-card', icon: <Layers size={14} />, label: 'Multi-card' },
    { id: 'log-sheet', icon: <FileSpreadsheet size={14} />, label: 'Log sheet' },
];

const Help: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const clipParam = searchParams.get('clip');
    const highlightedId = useMemo(() => getHelpClip(clipParam)?.id, [clipParam]);

    const selectClip = (id: HelpClipId) => {
        setSearchParams({ clip: id }, { replace: true });
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Help & tips</h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 p-4 pb-10 space-y-5 max-w-lg mx-auto w-full">
                <div className="card-elevated rounded-2xl p-4 border border-brand-800/40">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-800/80 flex items-center justify-center shrink-0">
                            <HelpCircle className="w-5 h-5 text-brand-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">60-second scan guides</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Short clips for single card, multi-card layout, and log sheets.
                                Until videos are uploaded, each slot shows framing tips you can use now.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        {QUICK_LINKS.map((q) => (
                            <button
                                key={q.id}
                                type="button"
                                onClick={() => selectClip(q.id)}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                                    highlightedId === q.id
                                        ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                                        : 'bg-brand-900/60 border-brand-800 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {q.icon}
                                {q.label}
                            </button>
                        ))}
                    </div>
                </div>

                {HELP_CLIPS.map((clip) => (
                    <HelpVideoCard
                        key={clip.id}
                        clip={clip}
                        highlighted={highlightedId === clip.id}
                    />
                ))}

                <p className="text-[11px] text-center text-slate-600 px-4">
                    Operators: add MP4s or YouTube URLs via{' '}
                    <span className="text-slate-500">HELP_VIDEOS.md</span>. Need legal or account help?{' '}
                    <Link to="/legal" className="text-brand-400 hover:underline">
                        Legal
                    </Link>
                    {' · '}
                    <Link to="/settings" className="text-brand-400 hover:underline">
                        Settings
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Help;
