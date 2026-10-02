import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '@/services/export';
import { makeContact } from '@/test/testUtils';

describe('exportService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('builds a CSV with contact fields and triggers a download', () => {
        const click = vi.fn();
        const appendSpy = vi.spyOn(document.body, 'appendChild');
        const removeSpy = vi.spyOn(document.body, 'removeChild');

        // Intercept the anchor created by downloadFile
        const realCreate = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'click', { value: click });
            }
            return el;
        });

        const contact = makeContact({
            name: 'Jane Doe',
            company: 'Acme Corp',
            phone: ['+1 555 0100'],
            email: ['jane@acme.example'],
        });

        exportService.toCSV([contact]);

        expect(click).toHaveBeenCalled();
        expect(appendSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();

        const anchor = appendSpy.mock.calls.find(
            (c) => (c[0] as HTMLElement).tagName === 'A'
        )?.[0] as HTMLAnchorElement;
        expect(anchor?.download).toMatch(/^contacts_export_\d+\.csv$/);
    });

    it('serializes a single contact to vCard 3.0', () => {
        const contact = makeContact({
            name: 'Jane Doe',
            position: 'Sales Manager',
            company: 'Acme Corp',
            phone: ['+63 917 123 4567'],
            email: ['jane.doe@acme.example'],
            address: 'Makati City, PH',
        });

        const vcard = exportService.contactToVCard(contact);
        expect(vcard).toContain('BEGIN:VCARD');
        expect(vcard).toContain('VERSION:3.0');
        expect(vcard).toContain('FN:Jane Doe');
        expect(vcard).toContain('ORG:Acme Corp');
        expect(vcard).toContain('TITLE:Sales Manager');
        expect(vcard).toContain('TEL;TYPE=WORK,VOICE:+63 917 123 4567');
        expect(vcard).toContain('EMAIL;TYPE=WORK:jane.doe@acme.example');
        expect(vcard).toContain('END:VCARD');
    });

    it('escapes quotes in CSV cells', () => {
        const click = vi.fn();
        const realCreate = document.createElement.bind(document);
        let downloadedHref = '';
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = realCreate(tag);
            if (tag === 'a') {
                Object.defineProperty(el, 'click', {
                    value: () => {
                        click();
                        downloadedHref = (el as HTMLAnchorElement).href;
                    },
                });
            }
            return el;
        });

        // Capture blob content via Blob constructor
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

        exportService.toCSV([
            makeContact({ name: 'O"Reilly', company: 'Foo, Bar Inc' }),
        ]);

        expect(click).toHaveBeenCalled();
        expect(blobs[0]).toContain('"O""Reilly"');
        expect(blobs[0]).toContain('"Foo, Bar Inc"');
        void downloadedHref;
    });
});
