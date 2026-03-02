import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { ArrowLeft, CameraOff, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseQRData } from '@/services/qrParser';
import ContactReview from '@/components/ContactReview';
import { OCRResult } from '@/services/ocr';

const QRScan: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scanLoopRef = useRef<number>(0);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [scannedResult, setScannedResult] = useState<OCRResult | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [lastScannedData, setLastScannedData] = useState<string | null>(null);
    const [scanCount, setScanCount] = useState(0);
    const navigate = useNavigate();

    const scanFrame = useCallback(() => {
        if (!webcamRef.current?.video || !canvasRef.current) {
            scanLoopRef.current = requestAnimationFrame(scanFrame);
            return;
        }

        const video = webcamRef.current.video;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            scanLoopRef.current = requestAnimationFrame(scanFrame);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });

        if (qrResult && qrResult.data && qrResult.data !== lastScannedData) {
            // QR code detected
            navigator.vibrate?.(200);
            setLastScannedData(qrResult.data);

            const parsed = parseQRData(qrResult.data);
            setScannedResult(parsed);
            setShowReview(true);
            return; // Stop scanning while review is open
        }

        scanLoopRef.current = requestAnimationFrame(scanFrame);
    }, [lastScannedData]);

    useEffect(() => {
        if (isCameraReady && !showReview) {
            scanLoopRef.current = requestAnimationFrame(scanFrame);
        }
        return () => {
            if (scanLoopRef.current) {
                cancelAnimationFrame(scanLoopRef.current);
            }
        };
    }, [isCameraReady, showReview, scanFrame]);

    const handleScanAnother = () => {
        setScanCount(prev => prev + 1);
        setShowReview(false);
        setScannedResult(null);
        setLastScannedData(null);
    };

    const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment',
    };

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">
                    QR Scanner{scanCount > 0 ? ` (${scanCount})` : ''}
                </h1>
                <div className="w-10" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                {cameraError ? (
                    <div className="w-full max-w-md aspect-square rounded-2xl overflow-hidden glass relative border-2 border-red-500/30 flex flex-col items-center justify-center gap-4 p-6">
                        <div className="p-4 rounded-full bg-red-500/10">
                            <CameraOff size={40} className="text-red-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-semibold text-red-400 mb-1">Camera Access Denied</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{cameraError}</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md aspect-square rounded-2xl overflow-hidden glass relative border-2 border-brand-500/30">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            videoConstraints={videoConstraints}
                            onUserMedia={() => setIsCameraReady(true)}
                            onUserMediaError={(err) => {
                                const msg = err instanceof DOMException && err.name === 'NotAllowedError'
                                    ? 'Please allow camera access in your browser settings and reload the page.'
                                    : 'Could not access camera. Make sure no other app is using it, then reload.';
                                setCameraError(msg);
                            }}
                            className="w-full h-full object-cover"
                        />
                        {/* QR Viewfinder Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Corner brackets */}
                            <div className="w-2/3 aspect-square relative">
                                {/* Top-left */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-brand-400 rounded-tl-lg" />
                                {/* Top-right */}
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-brand-400 rounded-tr-lg" />
                                {/* Bottom-left */}
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-brand-400 rounded-bl-lg" />
                                {/* Bottom-right */}
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-brand-400 rounded-br-lg" />
                            </div>
                            {/* Scanning pulse */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2/3 aspect-square border-2 border-brand-400/20 rounded-lg animate-pulse" />
                            </div>
                        </div>
                        {/* Loading spinner before camera is ready */}
                        {!isCameraReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-950">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-400" />
                            </div>
                        )}
                    </div>
                )}

                {/* Hidden canvas for QR decoding */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Status indicator */}
                <div className="mt-8 flex items-center gap-3">
                    {!cameraError && isCameraReady && !showReview && (
                        <>
                            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                            <p className="text-sm text-brand-400">Scanning for QR codes...</p>
                        </>
                    )}
                </div>

                <p className="mt-4 text-sm text-brand-400 text-center max-w-xs leading-relaxed">
                    {cameraError
                        ? ''
                        : !isCameraReady
                            ? 'Starting camera...'
                            : 'Point your camera at a QR code. It will be detected automatically.'}
                </p>

                {/* Scan count indicator */}
                {scanCount > 0 && !showReview && (
                    <button
                        onClick={() => navigate('/contacts')}
                        className="mt-6 px-6 py-3 bg-brand-100 text-brand-950 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all"
                    >
                        <QrCode size={18} />
                        Done ({scanCount} scanned)
                    </button>
                )}

                {/* ContactReview modal */}
                {showReview && scannedResult && (
                    <ContactReview
                        ocrResult={scannedResult}
                        imageData=""
                        onCancel={() => {
                            setShowReview(false);
                            setScannedResult(null);
                            setLastScannedData(null);
                        }}
                        onSave={() => {
                            setScanCount(prev => prev + 1);
                            navigate('/contacts');
                        }}
                        onScanAnother={handleScanAnother}
                    />
                )}
            </div>
        </div>
    );
};

export default QRScan;
