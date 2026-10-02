import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Film, ChevronRight, Lightbulb } from 'lucide-react';
import {
    HelpClip,
    clipHasMedia,
    youtubeIdFromUrl,
} from '@/config/helpVideos';

interface HelpVideoCardProps {
    clip: HelpClip;
    highlighted?: boolean;
}

const HelpVideoCard: React.FC<HelpVideoCardProps> = ({ clip, highlighted }) => {
    const cardRef = useRef<HTMLElement>(null);
    const hasMedia = clipHasMedia(clip);
    const ytId = youtubeIdFromUrl(clip.youtubeUrl);

    useEffect(() => {
        if (highlighted && cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [highlighted]);

    return (
        <article
            ref={cardRef}
            id={`help-${clip.id}`}
            className={`card-elevated rounded-2xl overflow-hidden border transition-colors ${
                highlighted ? 'border-brand-400/50 ring-1 ring-brand-500/30' : 'border-brand-800/40'
            }`}
        >
            <div className="relative aspect-video bg-brand-950">
                {clip.mp4Src ? (
                    <video
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                        src={clip.mp4Src}
                    >
                        Your browser does not support video playback.
                    </video>
                ) : ytId ? (
                    <iframe
                        title={clip.title}
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${ytId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-900 via-brand-950 to-black px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-brand-800/80 border border-brand-700 flex items-center justify-center">
                            <Film className="w-7 h-7 text-brand-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-200">Video slot ready</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                Drop an MP4 in <code className="text-brand-400">public/help/</code> or set a YouTube URL in{' '}
                                <code className="text-brand-400">helpVideos.ts</code>.
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-brand-900/80 border border-brand-800 px-2.5 py-1 rounded-full">
                            <Play size={10} />
                            Placeholder · {clip.durationLabel}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">{clip.title}</h2>
                        <p className="text-xs text-brand-400 mt-0.5">{clip.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-brand-900 border border-brand-800 px-2 py-1 rounded-lg">
                        {clip.durationLabel}
                    </span>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">{clip.description}</p>

                <ul className="space-y-1.5">
                    {clip.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-xs text-slate-400">
                            <Lightbulb size={12} className="text-amber-400/80 mt-0.5 shrink-0" />
                            <span>{tip}</span>
                        </li>
                    ))}
                </ul>

                <Link
                    to={clip.tryRoute}
                    className="flex items-center justify-between w-full mt-1 py-2.5 px-3 rounded-xl bg-brand-800/60 hover:bg-brand-800 border border-brand-700 text-sm font-medium text-brand-200 transition-colors"
                >
                    <span>{hasMedia ? 'Try it yourself' : clip.tryLabel}</span>
                    <ChevronRight size={16} className="text-brand-500" />
                </Link>
            </div>
        </article>
    );
};

export default HelpVideoCard;
