import jsQR from 'jsqr';
import { parseQRData } from './qrParser';
import { OCRResult } from './ocr';

/**
 * Attempt to decode a QR code from an image data URL.
 * Returns the parsed OCRResult if a QR code is found, null otherwise.
 */
export async function tryDecodeQR(dataURL: string): Promise<OCRResult | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                resolve(null);
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
            });

            if (qrResult && qrResult.data) {
                const parsed = parseQRData(qrResult.data);
                // Only use QR result if it has meaningful contact data (name, phone, or email).
                // If the QR is just a URL or plain text, fall through to OCR for the card text.
                const hasMeaningfulData = parsed.name || parsed.phone.length > 0 || parsed.email.length > 0;
                resolve(hasMeaningfulData ? parsed : null);
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataURL;
    });
}
