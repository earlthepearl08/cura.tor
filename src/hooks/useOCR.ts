import { useState, useCallback } from 'react';
import { ocrService, OCRResult } from '@/services/ocr';
import { classifyScanError, type ScanErrorKind } from '@/utils/friendlyScanError';

interface OCRState {
    isProcessing: boolean;
    progress: number;
    error: string | null;
    errorKind: ScanErrorKind | null;
    result: OCRResult | null;
}

export const useOCR = () => {
    const [state, setState] = useState<OCRState>({
        isProcessing: false,
        progress: 0,
        error: null,
        errorKind: null,
        result: null,
    });

    const processImage = useCallback(async (imageSrc: string) => {
        setState(prev => ({ ...prev, isProcessing: true, error: null, errorKind: null, progress: 10 }));

        try {
            const result = await ocrService.processImage(imageSrc);
            setState({
                isProcessing: false,
                progress: 100,
                error: null,
                errorKind: null,
                result
            });
            return result;
        } catch (err) {
            console.error('[OCR] processImage failed:', err);
            const friendly = classifyScanError(err);
            setState(prev => ({
                ...prev,
                isProcessing: false,
                error: friendly.message,
                errorKind: friendly.kind,
            }));
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        setState({
            isProcessing: false,
            progress: 0,
            error: null,
            errorKind: null,
            result: null
        });
    }, []);

    return {
        ...state,
        processImage,
        reset
    };
};
