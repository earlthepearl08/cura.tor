import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCcw, Check, ArrowLeft, CameraOff, Layers, Zap, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOCR } from '@/hooks/useOCR';
import ContactReview from '@/components/ContactReview';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useAuth } from '@/contexts/AuthContext';
import { compressBase64ForOCR } from '@/utils/compressPhoto';
import { formatOcrLanguageSummary, t } from '@/i18n';

const Scanner: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
    const [batchMode, setBatchMode] = useState(false);
    const [batchCount, setBatchCount] = useState(0);
    const { isProcessing, processImage, result, error, errorKind, reset } = useOCR();
    const navigate = useNavigate();
    const { canPerformScan, incrementScanCount, user, scansRemaining } = useAuth();
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const atScanLimit = !canPerformScan();
    const lowOnScans =
        user?.tier === 'free' &&
        typeof scansRemaining === 'number' &&
        scansRemaining > 0 &&
        scansRemaining <= 2;

    useEffect(() => {
        if (errorKind === 'quota') setShowUpgradePrompt(true);
    }, [errorKind]);

    const capture = useCallback(async () => {
        // Send the full uncropped camera frame to OCR. Earlier versions cropped
        // to a 1.586 viewfinder rectangle here, which silently chopped off card
        // content (e.g. the right-edge "KINMO PW" stacked logo) BEFORE the image
        // ever reached Gemini. Multi-Card and Upload don't crop and they parse
        // correctly — Gemini 2.5 can find the card in the full frame on its own.
        // The viewfinder UI overlay still helps the user aim, but it is not a
        // hard crop boundary anymore.
        const video = webcamRef.current?.video;
        const screenshotDims = video
            ? { width: video.videoWidth, height: video.videoHeight }
            : undefined;
        const imageSrc = webcamRef.current?.getScreenshot(screenshotDims);
        if (imageSrc) {
            setImgSrc(imageSrc);
        }
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
    };

    const handleTapToFocus = useCallback(async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!webcamRef.current || imgSrc) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;

        // Show focus animation
        setFocusPoint({ x, y });
        setTimeout(() => setFocusPoint(null), 1000);

        // Apply focus constraints
        try {
            const stream = webcamRef.current.stream;
            if (!stream) return;

            const videoTrack = stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities?.();

            if (capabilities && 'focusMode' in capabilities) {
                await videoTrack.applyConstraints({
                    advanced: [{ focusMode: 'single-shot' }] as any,
                });
            }
        } catch (err) {
            console.log('Tap-to-focus not supported:', err);
        }
    }, [imgSrc]);

    const videoConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: "environment" // Use back camera
    };

    const applyCameraFocus = useCallback(async () => {
        try {
            const stream = webcamRef.current?.stream;
            if (!stream) return;

            const videoTrack = stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities?.();

            // Apply continuous autofocus if supported
            if (capabilities && 'focusMode' in capabilities) {
                await videoTrack.applyConstraints({
                    advanced: [
                        { focusMode: 'continuous' } as any,
                        { focusDistance: { ideal: 0.25 } } as any
                    ]
                });
            }
        } catch (err) {
            console.log('Focus constraints not supported:', err);
        }
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <header className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button
                    type="button"
                    onClick={() => navigate('/app')}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Back to home"
                >
                    <ArrowLeft size={24} aria-hidden="true" />
                </button>
                <h1 className="text-lg font-semibold gradient-text">
                    {batchMode ? `Batch Scan${batchCount > 0 ? ` (${batchCount})` : ''}` : 'Scan Card'}
                </h1>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => navigate('/help?clip=single-card')}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-brand-300"
                        title="Help: single card scan"
                        aria-label="Help: single card scan"
                    >
                        <HelpCircle size={20} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => { setBatchMode(!batchMode); setBatchCount(0); }}
                        className={`p-2 rounded-full transition-colors ${batchMode ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/10 text-slate-500'}`}
                        title={batchMode ? 'Exit batch mode' : 'Batch scan mode'}
                        aria-label={batchMode ? 'Exit batch mode' : 'Enable batch scan mode'}
                        aria-pressed={batchMode}
                    >
                        <Layers size={20} aria-hidden="true" />
                    </button>
                </div>
            </header>

            {(atScanLimit || lowOnScans) && !showReview && (
                <div className={`mx-4 mt-2 p-3 rounded-xl text-xs flex items-start gap-2 ${
                    atScanLimit
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        : 'bg-sky-500/10 border border-sky-500/25 text-sky-300'
                }`} role="status" aria-live="polite">
                    <Zap size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1">
                        {atScanLimit ? (
                            <>
                                <p className="font-semibold mb-0.5">No card scans left</p>
                                <p className="text-[11px] opacity-90">
                                    Upgrade for more, or use QR scan / manual entry (no scan credit).
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowUpgradePrompt(true)}
                                    className="mt-2 text-[11px] font-bold underline underline-offset-2"
                                >
                                    See upgrade options
                                </button>
                            </>
                        ) : (
                            <p>
                                {scansRemaining} card scan{scansRemaining === 1 ? '' : 's'} left this period.
                                QR codes and manual entry stay free.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <main id="main-content" className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {!imgSrc ? (
                    cameraError ? (
                        <div className="w-full max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden glass relative border-2 border-red-500/30 flex flex-col items-center justify-center gap-4 p-6" role="alert">
                            <div className="p-4 rounded-full bg-red-500/10" aria-hidden="true">
                                <CameraOff size={40} className="text-red-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-red-400 mb-1">Camera Access Denied</p>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {cameraError}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/upload')}
                                className="mt-2 px-4 py-2 text-sm glass rounded-xl hover:bg-white/10 transition-colors"
                            >
                                Upload an image instead
                            </button>
                        </div>
                    ) : (
                    <div
                        className="w-full max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden glass relative border-2 border-brand-500/30 cursor-pointer"
                        onClick={handleTapToFocus}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                capture();
                            }
                        }}
                        role="img"
                        aria-label="Camera viewfinder. Tap to focus. Use the capture button below to take a photo."
                        tabIndex={0}
                    >
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={1.0}
                            videoConstraints={videoConstraints}
                            onUserMedia={() => {
                                setIsCameraReady(true);
                                applyCameraFocus();
                            }}
                            onUserMediaError={(err) => {
                                const msg = err instanceof DOMException && err.name === 'NotAllowedError'
                                    ? 'Please allow camera access in your browser settings and reload the page.'
                                    : 'Could not access camera. Make sure no other app is using it, then reload.';
                                setCameraError(msg);
                            }}
                            className="w-full h-full object-cover"
                        />
                        {/* Viewfinder Overlay */}
                        <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40" aria-hidden="true">
                            <div className="w-full h-full border-2 border-dashed border-brand-400 opacity-50 rounded-lg"></div>
                        </div>
                        {/* Focus Point Animation */}
                        {focusPoint && (
                            <div
                                className="absolute w-16 h-16 border-2 border-emerald-400 rounded-full pointer-events-none animate-ping"
                                style={{
                                    left: `${focusPoint.x}%`,
                                    top: `${focusPoint.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                                aria-hidden="true"
                            />
                        )}
                        {!isCameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-950" role="status" aria-live="polite">
                                <span className="sr-only">Starting camera</span>
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-400" aria-hidden="true"></div>
                            </div>
                        )}
                    </div>
                    )
                ) : (
                    <div className="w-full max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden glass relative border-2 border-emerald-500/50">
                        <img src={imgSrc} alt="Captured business card preview" className="w-full h-full object-cover" />
                        {/* Processing Overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 bg-brand-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4" role="status" aria-live="polite" aria-busy="true">
                                <span className="sr-only">Analyzing card, extracting contact info</span>
                                <div className="relative w-16 h-16" aria-hidden="true">
                                    <div className="absolute inset-0 border-4 border-brand-700 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-transparent border-t-sky-400 rounded-full animate-spin"></div>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-sky-400">Analyzing Card</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Extracting contact info...</p>
                                </div>
                                {/* Scan line animation */}
                                <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-scan-line" aria-hidden="true"></div>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-12 flex items-center gap-6" role="group" aria-label="Capture controls">
                    {!imgSrc ? (
                        <button
                            type="button"
                            onClick={capture}
                            disabled={!isCameraReady}
                            aria-label="Capture photo"
                            className="h-20 w-20 rounded-full bg-brand-100 flex items-center justify-center text-brand-950 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                        >
                            <Camera size={32} aria-hidden="true" />
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={retake}
                                aria-label="Retake photo"
                                className="h-16 w-16 rounded-full glass flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <RefreshCcw size={28} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (imgSrc) {
                                        if (!canPerformScan()) {
                                            setShowUpgradePrompt(true);
                                            return;
                                        }
                                        // Compress before sending to API to stay under Vercel's 4.5MB body limit
                                        const compressed = await compressBase64ForOCR(imgSrc);
                                        const ocrResult = await processImage(compressed);
                                        if (ocrResult) {
                                            await incrementScanCount();
                                            setShowReview(true);
                                        }
                                    }
                                }}
                                disabled={isProcessing}
                                aria-label="Confirm photo and start OCR"
                                aria-busy={isProcessing}
                                className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white" aria-hidden="true"></div>
                                ) : (
                                    <Check size={28} aria-hidden="true" />
                                )}
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-8 text-sm text-brand-400 text-center max-w-xs leading-relaxed" role="status" aria-live="polite">
                    {error ? (
                        <div className="space-y-2">
                            <p className="text-red-400">{error}</p>
                            {errorKind === 'quota' ? (
                                <button
                                    type="button"
                                    onClick={() => setShowUpgradePrompt(true)}
                                    className="text-xs font-medium text-amber-400 underline underline-offset-2"
                                >
                                    View upgrade options
                                </button>
                            ) : errorKind === 'auth' ? (
                                <button
                                    type="button"
                                    onClick={() => navigate('/settings')}
                                    className="text-xs font-medium text-brand-300 underline underline-offset-2"
                                >
                                    Open Settings
                                </button>
                            ) : errorKind === 'rate_limit' ? (
                                <p className="text-xs text-brand-500">Wait a moment, then tap the checkmark to retry</p>
                            ) : (
                                <p className="text-xs text-brand-500">Tap the checkmark to retry</p>
                            )}
                        </div>
                    ) : isProcessing ? (
                        "Extracting information using OCR..."
                    ) : !imgSrc ? (
                        cameraError ? "" : "Align the card within the frame. Tap anywhere to focus."
                    ) : (
                        "Preview confirmed. Tap the checkmark to start OCR processing."
                    )}
                </div>

                {!imgSrc && !cameraError && !isProcessing && (
                    <button
                        type="button"
                        onClick={() => navigate('/settings')}
                        className="mt-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-800/80 text-brand-300 border border-brand-700 hover:border-brand-500 transition-colors"
                        aria-label={`OCR languages: ${formatOcrLanguageSummary()}. Open settings to change.`}
                    >
                        {t('scan.ocrLangBadge', { langs: formatOcrLanguageSummary() })}
                    </button>
                )}

                {showReview && result && imgSrc && (
                    <ContactReview
                        ocrResult={result}
                        imageData={imgSrc}
                        onCancel={() => {
                            setShowReview(false);
                            reset();
                        }}
                        onSave={() => navigate('/contacts')}
                        onScanAnother={batchMode ? () => {
                            setBatchCount(prev => prev + 1);
                            setShowReview(false);
                            setImgSrc(null);
                            reset();
                        } : undefined}
                    />
                )}

                {batchMode && batchCount > 0 && !imgSrc && !showReview && !isProcessing && (
                    <button
                        type="button"
                        onClick={() => navigate('/contacts')}
                        className="mt-4 px-6 py-3 bg-brand-100 text-brand-950 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all"
                        aria-label={`Done batch scanning, ${batchCount} scanned`}
                    >
                        <Check size={18} aria-hidden="true" />
                        Done ({batchCount} scanned)
                    </button>
                )}

                {showUpgradePrompt && (
                    <UpgradePrompt
                        feature="scan"
                        onDismiss={() => setShowUpgradePrompt(false)}
                        scansUsed={user?.tier === 'early_access' ? (user.scanUsage.lifetimeCount || 0) : (user?.scanUsage.count || 0)}
                        scansLimit={user?.tier === 'early_access' ? (user.scanUsage.lifetimeLimit || 30) : 5}
                    />
                )}
            </main>
        </div>
    );
};

export default Scanner;
