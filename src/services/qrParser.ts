import { OCRResult } from './ocr';

/**
 * Parse QR code data into OCRResult format.
 * Supports vCard, meCard, tel:, mailto:, URLs, and plain text.
 */
export function parseQRData(raw: string): OCRResult {
    const trimmed = raw.trim();

    if (trimmed.toUpperCase().startsWith('BEGIN:VCARD')) {
        return parseVCard(trimmed);
    }
    if (trimmed.toUpperCase().startsWith('MECARD:')) {
        return parseMeCard(trimmed);
    }
    if (trimmed.startsWith('tel:')) {
        return {
            name: '', position: '', company: '', address: '',
            phone: [trimmed.slice(4)], email: [],
            rawText: trimmed, confidence: 80,
        };
    }
    if (trimmed.startsWith('mailto:')) {
        return {
            name: '', position: '', company: '', address: '',
            phone: [], email: [trimmed.slice(7).split('?')[0]],
            rawText: trimmed, confidence: 80,
        };
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return {
            name: '', position: '', company: '',
            phone: [], email: [], address: '',
            rawText: trimmed, confidence: 30,
        };
    }
    // Plain text fallback
    return {
        name: '', position: '', company: '',
        phone: [], email: [], address: '',
        rawText: trimmed, confidence: 30,
    };
}

/** Unfold vCard lines (RFC 6350 §3.2) and split into logical lines */
function unfoldVCard(text: string): string[] {
    return text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '').split('\n');
}

/** Get the value part of a vCard line, stripping type params */
function vcardValue(line: string): string {
    const colonIdx = line.indexOf(':');
    return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
}

/** Check if a vCard property key matches (ignoring params like ;TYPE=WORK) */
function vcardKeyIs(line: string, key: string): boolean {
    const upper = line.toUpperCase();
    return upper.startsWith(key + ':') || upper.startsWith(key + ';');
}

function parseVCard(text: string): OCRResult {
    const lines = unfoldVCard(text);
    let name = '';
    let position = '';
    let company = '';
    const phones: string[] = [];
    const emails: string[] = [];
    let address = '';
    let notes = '';

    for (const line of lines) {
        if (vcardKeyIs(line, 'FN')) {
            name = vcardValue(line);
        } else if (vcardKeyIs(line, 'N') && !vcardKeyIs(line, 'NOTE')) {
            // N:Last;First;Middle;Prefix;Suffix
            if (!name) {
                const parts = vcardValue(line).split(';');
                const last = parts[0] || '';
                const first = parts[1] || '';
                const middle = parts[2] || '';
                name = [first, middle, last].filter(Boolean).join(' ');
            }
        } else if (vcardKeyIs(line, 'ORG')) {
            company = vcardValue(line).replace(/;/g, ', ').replace(/, $/, '');
        } else if (vcardKeyIs(line, 'TITLE')) {
            position = vcardValue(line);
        } else if (vcardKeyIs(line, 'TEL')) {
            const phone = vcardValue(line).trim();
            if (phone) phones.push(phone);
        } else if (vcardKeyIs(line, 'EMAIL')) {
            const email = vcardValue(line).trim();
            if (email) emails.push(email);
        } else if (vcardKeyIs(line, 'ADR')) {
            // ADR:;;Street;City;State;Zip;Country
            const parts = vcardValue(line).split(';').filter(Boolean);
            if (parts.length > 0) address = parts.join(', ');
        } else if (vcardKeyIs(line, 'NOTE')) {
            notes = vcardValue(line);
        }
    }

    return {
        name,
        position,
        company,
        phone: phones,
        email: emails,
        address,
        rawText: notes || text,
        confidence: 100,
    };
}

function parseMeCard(text: string): OCRResult {
    // MECARD:N:Last,First;TEL:123;EMAIL:a@b.com;ORG:Company;NOTE:text;;
    const body = text.slice(7); // Remove "MECARD:"
    const pairs = body.split(';').filter(Boolean);

    let name = '';
    let company = '';
    const phones: string[] = [];
    const emails: string[] = [];
    let notes = '';

    for (const pair of pairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx < 0) continue;
        const key = pair.slice(0, colonIdx).toUpperCase();
        const val = pair.slice(colonIdx + 1);

        switch (key) {
            case 'N':
                // meCard name format: Last,First
                name = val.split(',').reverse().join(' ').trim();
                break;
            case 'TEL':
                if (val) phones.push(val);
                break;
            case 'EMAIL':
                if (val) emails.push(val);
                break;
            case 'ORG':
                company = val;
                break;
            case 'NOTE':
                notes = val;
                break;
        }
    }

    return {
        name,
        position: '',
        company,
        phone: phones,
        email: emails,
        address: '',
        rawText: notes || text,
        confidence: 100,
    };
}
