/**
 * Critical path: mock Gemini/OCR → save contact → export CSV.
 * No live network; IndexedDB via fake-indexeddb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '@/services/storage';
import { exportService } from '@/services/export';
import type { OCRResult } from '@/services/ocr';
import { Contact } from '@/types/contact';
import { makeOCRResult } from '@/test/testUtils';

const processImage = vi.fn<(imageSrc: string) => Promise<OCRResult>>();

/** Stand-in for ocrService.processImage — never touches Gemini/Vision */
const ocrService = { processImage };

/** Mirrors ContactReview contact construction from an OCR result */
function contactFromOCR(ocr: OCRResult, imageData: string): Contact {
    return {
        id: crypto.randomUUID(),
        name: ocr.name,
        position: ocr.position,
        company: ocr.company,
        phone: ocr.phone,
        email: ocr.email,
        address: ocr.address,
        notes: ocr.notes || '',
        folder: 'Uncategorized',
        rawText: ocr.rawText,
        imageData,
        confidence: ocr.confidence,
        isVerified: true,
        createdAt: Date.now(),
    };
}

describe('scan → save → export happy path', () => {
    beforeEach(async () => {
        storage.switchUser('flow-test-user');
        const existing = await storage.getAllContacts();
        await Promise.all(existing.map((c) => storage.hardDeleteContact(c.id)));
        processImage.mockReset();
    });

    it('processes a card image via mocked OCR, persists, and exports CSV', async () => {
        const ocr = makeOCRResult({
            name: 'Maria Santos',
            company: 'Kinmo PW',
            phone: ['09171234567'],
            email: ['maria@kinmo.example'],
        });
        processImage.mockResolvedValue(ocr);

        const imageData = 'data:image/jpeg;base64,/9j/mockcard';
        const result = await ocrService.processImage(imageData);

        expect(processImage).toHaveBeenCalledWith(imageData);
        expect(result.name).toBe('Maria Santos');
        expect(result.company).toBe('Kinmo PW');

        const contact = contactFromOCR(result, imageData);
        await storage.saveContact(contact);

        const saved = await storage.getAllContacts();
        expect(saved).toHaveLength(1);
        expect(saved[0].email).toEqual(['maria@kinmo.example']);
        expect(saved[0].phone).toEqual(['09171234567']);

        const blobs: string[] = [];
        const OriginalBlob = globalThis.Blob;
        vi.stubGlobal(
            'Blob',
            class extends OriginalBlob {
                constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
                    super(parts, options);
                    blobs.push(String(parts?.[0] ?? ''));
                }
            }
        );
        const click = vi.fn();
        const realCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'click', { value: click });
            }
            return el;
        });

        exportService.toCSV(saved);

        expect(click).toHaveBeenCalled();
        expect(blobs[0]).toContain('Maria Santos');
        expect(blobs[0]).toContain('Kinmo PW');
        expect(blobs[0]).toContain('maria@kinmo.example');
        expect(blobs[0]).toMatch(/^Name,Position,Company/);
    });

    it('does not call fetch when OCR is mocked', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        processImage.mockResolvedValue(makeOCRResult());

        await ocrService.processImage('data:image/png;base64,abc');

        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
