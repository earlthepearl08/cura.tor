import { useCallback, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, CameraOff, Sun } from 'lucide-react';
import LogSheetFramingOverlay from '@/components/LogSheetFramingOverlay';
import { compressBase64ForOCR } from '@/utils/compressPhoto';

interface LogSheetGuidedCameraProps {
    sheetNumber: number;
    onCapture: (imageData: string) => void;
    onClose: () => void;
    onUseGallery?: () => void;
}

const LogSheetGuidedCamera: React.FC<LogSheetGuidedCameraProps> = ({
    sheetNumber,
    onCapture,
    onClose,
    onUseGallery,
}) => {
    const webcamRef = useRef<Webcam>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);

    const videoConstraints = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: 'environment' as const,
    };

    const handleCapture = useCallback(async () => {
        const video = webcamRef.current?.video;
        const dims = video
            ? { width: video.videoWidth, height: video.videoHeight }
            : undefined;
        const shot = webcamRef.current?.getScreenshot(dims);
        if (!shot) return;
        setCapturing(true);
        try {
            const compressed = await compressBase64ForOCR(shot);
            onCapture(compressed);
        } finally {
            setCapturing(false);
        }
    }, [onCapture]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-brand-950">
            <div className="flex items-center justify-between p-4 glass">
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={22} />
                </button>
                <div className="text-center">
                    <h2 className="text-sm font-semibold text-slate-100">Guided capture</h2>
                    <p className="text-[10px] text-brand-400">Sheet {sheetNumber}</p>
                </div>
                <div className="w-10" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                {error ? (
                    <div className="w-full max-w-md aspect-[3/4] rounded-2xl border border-red-500/30 glass flex flex-col items-center justify-center gap-3 p-6">
                        <CameraOff size={36} className="text-red-400" />
                        <p className="text-sm text-red-300 text-center">{error}</p>
                        {onUseGallery && (
                            <button
                                onClick={onUseGallery}
                                className="mt-2 px-4 py-2 text-sm glass rounded-xl hover:bg-white/10"
                            >
                                Choose from gallery instead
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden relative border-2 border-brand-500/40 bg-black">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={1}
                            videoConstraints={videoConstraints}
                            onUserMedia={() => setReady(true)}
                            onUserMediaError={(err) => {
                                const msg = err instanceof DOMException && err.name === 'NotAllowedError'
                                    ? 'Allow camera access, then try again.'
                                    : 'Could not open camera. Try gallery upload instead.';
                                setError(msg);
                            }}
                            className="w-full h-full object-cover"
                        />
                        <LogSheetFramingOverlay live />
                        {!ready && (
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-950">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-400" />
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-start gap-2 max-w-md w-full px-1">
                    <Sun size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-brand-400 leading-relaxed">
                        Fill the frame with the table. Keep lighting even — glare on glossy paper hides handwriting.
                        Capture one sheet at a time; you can add the next page after.
                    </p>
                </div>

                <button
                    onClick={handleCapture}
                    disabled={!ready || !!error || capturing}
                    className="h-18 w-18 h-[4.5rem] w-[4.5rem] rounded-full bg-brand-100 text-brand-950 flex items-center justify-center shadow-lg disabled:opacity-40 active:scale-95 transition-all"
                    aria-label="Capture log sheet"
                >
                    {capturing ? (
                        <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-brand-800" />
                    ) : (
                        <Camera size={30} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default LogSheetGuidedCamera;
