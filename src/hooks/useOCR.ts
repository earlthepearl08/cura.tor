import { useState, useCallback } from 'react';
import { ocrService, OCRResult } from '@/services/ocr';

interface OCRState {
    isProcessing: boolean;
    progress: number;
    error: string | null;
    result: OCRResult | null;
}

export const useOCR = () => {
    const [state, setState] = useState<OCRState>({
        isProcessing: false,
        progress: 0,
        error: null,
        result: null,
    });

    const processImage = useCallback(async (imageSrc: string) => {
        setState(prev => ({ ...prev, isProcessing: true, error: null, progress: 10 }));

        try {
            // Small delay to simulate progress if needed, but Tesseract has its own events
            // For now, we just call the service
            const result = await ocrService.processImage(imageSrc);
            setState({
                isProcessing: false,
                progress: 100,
                error: null,
                result
            });
            return result;
        } catch (err) {
            setState(prev => ({
                ...prev,
                isProcessing: false,
                error: err instanceof Error ? err.message : 'failed to process image'
            }));
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            isProcessing: false,
            progress: 0,
            error: null,
            result: null
        });
    }, []);

    return {
        ...state,
        processImage,
        reset
    };
};
