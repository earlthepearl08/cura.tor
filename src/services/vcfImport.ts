import { Contact } from '@/types/contact';

export interface ParsedVCard {
    name: string;
    position: string;
    company: string;
    phone: string[];
    email: string[];
    address: string;
    notes: string;
}

/** Unfold continuation lines per RFC 6350 (lines starting with space/tab are continuations) */
function unfold(raw: string): string {
    return raw.replace(/\r?\n[ \t]/g, '');
}

/** Decode quoted-printable value */
function decodeQP(val: string): string {
    return val.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/=\r?\n/g, '');
}

/** Get the plain value from a vCard line, handling encoding */
function extractValue(line: string): string {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return '';
    const params = line.substring(0, colonIdx).toUpperCase();
    let val = line.substring(colonIdx + 1).trim();
    if (params.includes('ENCODING=QUOTED-PRINTABLE')) {
        val = decodeQP(val);
    }
    return val;
}

/** Get the property name (before params/colon) */
function getPropName(line: string): string {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return '';
    const beforeColon = line.substring(0, colonIdx);
    // Property name is before the first ; (params separator)
    const semiIdx = beforeColon.indexOf(';');
    return (semiIdx === -1 ? beforeColon : beforeColon.substring(0, semiIdx)).toUpperCase();
}

function parseOneVCard(block: string): ParsedVCard {
    const lines = unfold(block).split(/\r?\n/);
    const result: ParsedVCard = {
        name: '', position: '', company: '',
        phone: [], email: [], address: '', notes: '',
    };

    for (const line of lines) {
        const prop = getPropName(line);
        const val = extractValue(line);
        if (!val) continue;

        switch (prop) {
            case 'FN':
                result.name = val;
                break;
            case 'N': {
                // N:Last;First;Middle;Prefix;Suffix
                if (!result.name) {
                    const parts = val.split(';');
                    const first = parts[1] || '';
                    const last = parts[0] || '';
                    result.name = `${first} ${last}`.trim();
                }
                break;
            }
            case 'ORG':
                result.company = val.replace(/;/g, ' ').trim();
                break;
            case 'TITLE':
                result.position = val;
                break;
            case 'TEL':
                if (val) result.phone.push(val);
                break;
            case 'EMAIL':
                if (val) result.email.push(val);
                break;
            case 'ADR': {
                // ADR:PO Box;Extended;Street;City;Region;Postal;Country
                const addrParts = val.split(';').filter(p => p.trim());
                result.address = addrParts.join(', ');
                break;
            }
            case 'NOTE':
                result.notes = val;
                break;
        }
    }

    return result;
}

/** Parse a .vcf file content into an array of parsed vCards */
export function parseVCF(content: string): ParsedVCard[] {
    const blocks = content.split(/(?=BEGIN:VCARD)/i);
    const results: ParsedVCard[] = [];

    for (const block of blocks) {
        if (!block.toUpperCase().includes('BEGIN:VCARD')) continue;
        const parsed = parseOneVCard(block);
        if (parsed.name || parsed.company || parsed.phone.length || parsed.email.length) {
            results.push(parsed);
        }
    }

    return results;
}

/** Convert parsed vCards into Contact objects ready for storage */
export function vcfToContacts(parsed: ParsedVCard[], folder: string): Contact[] {
    return parsed.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        position: p.position,
        company: p.company,
        phone: p.phone,
        email: p.email,
        address: p.address,
        notes: p.notes,
        folder: folder || 'Uncategorized',
        rawText: '',
        imageData: '',
        confidence: 100,
        isVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    }));
}
