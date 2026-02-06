import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCcw, Check, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOCR } from '@/hooks/useOCR';
import ContactReview from '@/components/ContactReview';

const Scanner: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
    const { isProcessing, processImage, result, error, reset } = useOCR();
    const navigate = useNavigate();

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
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
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Scan Card</h1>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {!imgSrc ? (
                    <div
                        className="w-full max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden glass relative border-2 border-brand-500/30 cursor-pointer"
                        onClick={handleTapToFocus}
                        onTouchStart={handleTapToFocus}
                    >
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            onUserMedia={() => {
                                setIsCameraReady(true);
                                applyCameraFocus();
                            }}
                            className="w-full h-full object-cover"
                        />
                        {/* Viewfinder Overlay */}
                        <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
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
                            />
                        )}
                        {!isCameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-950">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-400"></div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden glass relative border-2 border-emerald-500/50">
                        <img src={imgSrc} alt="captured" className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="mt-12 flex items-center gap-6">
                    {!imgSrc ? (
                        <button
                            onClick={capture}
                            disabled={!isCameraReady}
                            className="h-20 w-20 rounded-full bg-brand-100 flex items-center justify-center text-brand-950 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                        >
                            <Camera size={32} />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={retake}
                                className="h-16 w-16 rounded-full glass flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <RefreshCcw size={28} />
                            </button>
                            <button
                                onClick={async () => {
                                    if (imgSrc) {
                                        const ocrResult = await processImage(imgSrc);
                                        if (ocrResult) {
                                            setShowReview(true);
                                        }
                                    }
                                }}
                                disabled={isProcessing}
                                className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
                                ) : (
                                    <Check size={28} />
                                )}
                            </button>
                        </>
                    )}
                </div>

                <p className="mt-8 text-sm text-brand-400 text-center max-w-xs leading-relaxed">
                    {error
                        ? <span className="text-red-400">Error: {error}</span>
                        : isProcessing
                            ? "Extracting information using OCR..."
                            : !imgSrc
                                ? "Align the card within the frame. Tap anywhere to focus."
                                : "Preview confirmed. Tap the checkmark to start OCR processing."}
                </p>

                {showReview && result && imgSrc && (
                    <ContactReview
                        ocrResult={result}
                        imageData={imgSrc}
                        onCancel={() => {
                            setShowReview(false);
                            reset();
                        }}
                        onSave={() => navigate('/contacts')}
                    />
                )}
            </div>
        </div>
    );
};

export default Scanner;
