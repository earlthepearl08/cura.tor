/**
 * Visual framing guide for log-sheet capture.
 * Used as a static preview on the capture stage and as a live camera overlay.
 */
interface LogSheetFramingOverlayProps {
    /** Compact mode for the pre-capture card */
    compact?: boolean;
    /** Live camera: slightly stronger contrast */
    live?: boolean;
}

const LogSheetFramingOverlay: React.FC<LogSheetFramingOverlayProps> = ({ compact, live }) => {
    const line = live ? 'border-brand-300/70' : 'border-brand-400/50';
    const corner = live ? 'border-emerald-400' : 'border-brand-400';

    return (
        <div className={`absolute inset-0 pointer-events-none ${compact ? 'p-4' : 'p-5'}`}>
            {/* Dim outside table frame */}
            <div className={`absolute inset-0 ${live ? 'bg-black/35' : 'bg-brand-950/40'}`} />

            {/* Table alignment frame */}
            <div className="absolute inset-[10%] sm:inset-[12%]">
                <div className={`absolute inset-0 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] ${live ? '' : ''}`} />

                {/* Corner brackets */}
                <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${corner} rounded-tl-sm`} />
                <div className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${corner} rounded-tr-sm`} />
                <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${corner} rounded-bl-sm`} />
                <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${corner} rounded-br-sm`} />

                {/* Outer table border */}
                <div className={`absolute inset-0 border border-dashed ${line} rounded-sm`} />

                {/* Header row */}
                <div className={`absolute top-[8%] left-[3%] right-[3%] h-[12%] border ${line} bg-brand-400/10`}>
                    <div className="h-full flex items-center justify-center">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${live ? 'text-brand-200' : 'text-brand-400'}`}>
                            Headers
                        </span>
                    </div>
                </div>

                {/* Row guides */}
                {[0, 1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className={`absolute left-[3%] right-[3%] border-t ${line}`}
                        style={{ top: `${24 + i * 14}%` }}
                    />
                ))}

                {/* Column guides */}
                {[25, 50, 75].map(x => (
                    <div
                        key={x}
                        className={`absolute top-[8%] bottom-[6%] border-l ${line}`}
                        style={{ left: `${x}%` }}
                    />
                ))}
            </div>

            {/* Tip chips */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-2">
                <span className="px-2 py-0.5 rounded-full bg-black/55 text-[9px] font-semibold text-brand-200 border border-brand-500/30">
                    Align table edges
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/55 text-[9px] font-semibold text-amber-200 border border-amber-500/30">
                    Avoid glare
                </span>
            </div>
        </div>
    );
};

export default LogSheetFramingOverlay;
