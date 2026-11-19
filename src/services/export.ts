import * as XLSX from 'xlsx';
import { Contact } from '@/types/contact';
import { contactsToCrmValueMatrix } from '@/services/crmExport';
import { contactsToSalesforceValueMatrix } from '@/services/salesforceExport';
import { FOLLOW_UP_LABELS, effectiveFollowUpStatus } from '@/services/followUp';

export type BatchMap = Record<string, string>;

function escapeCsvCell(cell: string | number | undefined | null): string {
    return `"${(cell ?? '').toString().replace(/"/g, '""')}"`;
}

/** UTF-8 byte-order mark so Excel opens accented / CJK names (Ñ, 陈) correctly. */
const CSV_BOM = '\uFEFF';

/** RFC 2426 text escaping for vCard values. */
function vEscape(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

const NAME_PREFIXES = new Set([
    'mr', 'mrs', 'ms', 'miss', 'dr', 'engr', 'atty', 'arch', 'prof', 'hon', 'rev', 'fr', 'gen', 'col', 'capt',
]);
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
/** Post-nominals seen on PH cards: REE, PEE, CPA, RN, MBA, PhD, MD, Ph.D. ... */
const CREDENTIAL_RE = /^(?:[A-Z]{2,6}|Ph\.?D\.?|M\.?D\.?|Esq\.?)$/;
/** Surname particles that belong to the family name (dela Cruz, de los Santos, Van Buren). */
const SURNAME_PARTICLES = new Set(['de', 'del', 'dela', 'la', 'las', 'los', 'delos', 'di', 'da', 'san', 'sta', 'sta.', 'sto', 'sto.', 'van', 'von', 'y']);

function isSuffixOrCredential(part: string): boolean {
    return NAME_SUFFIXES.has(part.replace(/\./g, '').toLowerCase()) || CREDENTIAL_RE.test(part);
}

/**
 * Split a display name into vCard N parts. Handles PH card conventions:
 * "Engr. Maria Santos, REE, PEE" -> prefix "Engr.", given "Maria",
 * family "Santos", suffix "REE, PEE" (previously filed under last name "PEE");
 * "Juan dela Cruz" -> family "dela Cruz"; "Santos, Maria" -> family "Santos".
 */
export function splitPersonName(displayName: string): { prefix: string; given: string; family: string; suffix: string } {
    const [main, ...afterCommaRaw] = displayName.split(',');
    const afterComma = afterCommaRaw.map(p => p.trim()).filter(Boolean);
    const allCredentials = afterComma.length > 0 && afterComma.every(p => p.split(/\s+/).every(isSuffixOrCredential));

    // "Santos, Maria Cristina" (family-first) — comma part is not credentials.
    if (afterComma.length > 0 && !allCredentials) {
        const familyTokens = main.trim().split(/\s+/).filter(Boolean);
        if (familyTokens.length <= 3) {
            return { prefix: '', given: afterComma.join(' '), family: familyTokens.join(' '), suffix: '' };
        }
    }

    const suffixParts = allCredentials ? [...afterComma] : [];
    const tokens = main.trim().split(/\s+/).filter(Boolean);
    const prefixes: string[] = [];
    // Only strip an honorific when at least two name tokens remain after it.
    while (tokens.length > 2 && NAME_PREFIXES.has(tokens[0].replace(/\./g, '').toLowerCase())) {
        prefixes.push(tokens.shift() as string);
    }
    while (tokens.length > 2 && NAME_SUFFIXES.has(tokens[tokens.length - 1].replace(/\./g, '').toLowerCase())) {
        suffixParts.unshift(tokens.pop() as string);
    }
    if (tokens.length < 2) {
        return { prefix: prefixes.join(' '), given: tokens.join(' '), family: '', suffix: suffixParts.join(', ') };
    }
    const familyParts = [tokens.pop() as string];
    while (tokens.length > 1 && SURNAME_PARTICLES.has(tokens[tokens.length - 1].toLowerCase())) {
        familyParts.unshift(tokens.pop() as string);
    }
    return { prefix: prefixes.join(' '), given: tokens.join(' '), family: familyParts.join(' '), suffix: suffixParts.join(', ') };
}

function contactExportRow(c: Contact, batchMap?: BatchMap) {
    const status = effectiveFollowUpStatus(c);
    return {
        Name: c.name,
        Position: c.position,
        Company: c.company,
        Phone: c.phone.join('; '),
        Email: c.email.join('; '),
        Address: c.address,
        Notes: c.notes || '',
        ...(c.customFields || {}),
        Folder: c.folder || 'Uncategorized',
        Batch: (c.batchId && batchMap?.[c.batchId]) || '',
        ClaimedBy: c.claimedByName || '',
        FollowUpStatus: status ? FOLLOW_UP_LABELS[status] : (c.claimedBy ? 'Claimed' : 'Unclaimed'),
        FollowUpDue: c.followUpDueAt ? new Date(c.followUpDueAt).toLocaleString() : '',
        ScannedAt: new Date(c.createdAt).toLocaleString(),
        UpdatedAt: c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '',
    };
}

export const exportService = {
    toExcel(contacts: Contact[], batchMap?: BatchMap) {
        const data = contacts.map(c => contactExportRow(c, batchMap));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
        XLSX.writeFile(workbook, `contacts_export_${Date.now()}.xlsx`);
    },

    toCSV(contacts: Contact[], batchMap?: BatchMap) {
        const customKeys = Array.from(
            new Set(contacts.flatMap(c => Object.keys(c.customFields || {}))),
        ).sort();
        const headers = [
            'Name', 'Position', 'Company', 'Phone', 'Email', 'Address', 'Notes',
            ...customKeys,
            'Folder', 'Batch', 'ClaimedBy', 'FollowUpStatus', 'FollowUpDue',
            'ScannedAt', 'UpdatedAt',
        ];
        const rows = contacts.map(c => {
            const row = contactExportRow(c, batchMap) as Record<string, string>;
            return headers.map((h) => row[h] ?? c.customFields?.[h] ?? '');
        });

        const csvContent = CSV_BOM + [
            headers.join(','),
            ...rows.map(row => row.map(cell => escapeCsvCell(cell)).join(','))
        ].join('\n');

        this.downloadFile(csvContent, `contacts_export_${Date.now()}.csv`, 'text/csv');
    },

    /**
     * CRM-ready CSV (HubSpot / Salesforce-friendly headers).
     * See CRM_EXPORT_MAPPING.md. Complements Salesforce API-header CSV below.
     */
    toCRMCSV(contacts: Contact[], batchMap?: BatchMap) {
        const matrix = contactsToCrmValueMatrix(contacts, batchMap);
        const csvContent = CSV_BOM + matrix
            .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
            .join('\n');
        this.downloadFile(csvContent, `contacts_crm_export_${Date.now()}.csv`, 'text/csv');
    },

    /**
     * Salesforce Import Wizard / Data Loader CSV (API field headers).
     * See SALESFORCE_EXPORT.md. Complements HubSpot-oriented CRM CSV above.
     */
    toSalesforceCSV(contacts: Contact[], batchMap?: BatchMap) {
        const matrix = contactsToSalesforceValueMatrix(contacts, batchMap);
        const csvContent = CSV_BOM + matrix
            .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
            .join('\n');
        this.downloadFile(csvContent, `contacts_salesforce_export_${Date.now()}.csv`, 'text/csv');
    },

    /** Export only unclaimed team leads (CSV). */
    toUnclaimedCSV(contacts: Contact[], batchMap?: BatchMap) {
        const unclaimed = contacts.filter((c) => !c.claimedBy);
        this.toCSV(unclaimed, batchMap);
    },

    /** Generate vCard string for a single contact */
    contactToVCard(contact: Contact): string {
        const displayName = (contact.name || contact.company || 'Unknown Contact').trim();
        const n = contact.name ? splitPersonName(displayName) : { prefix: '', given: '', family: '', suffix: '' };

        let vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
        vcard += `N:${vEscape(n.family)};${vEscape(n.given)};;${vEscape(n.prefix)};${vEscape(n.suffix)}\r\n`;
        vcard += `FN:${vEscape(displayName)}\r\n`;

        if (contact.company) {
            vcard += `ORG:${vEscape(contact.company)}\r\n`;
        }
        if (contact.position) {
            vcard += `TITLE:${vEscape(contact.position)}\r\n`;
        }
        for (const phone of contact.phone) {
            vcard += `TEL;TYPE=WORK,VOICE:${vEscape(phone)}\r\n`;
        }
        for (const email of contact.email) {
            vcard += `EMAIL;TYPE=WORK:${vEscape(email)}\r\n`;
        }
        if (contact.address) {
            vcard += `ADR;TYPE=WORK:;;${vEscape(contact.address)};;;;\r\n`;
        }
        if (contact.notes) {
            vcard += `NOTE:${vEscape(contact.notes)}\r\n`;
        }

        vcard += 'END:VCARD\r\n';
        return vcard;
    },

    /** Download a single contact as .vcf */
    toVCard(contact: Contact) {
        const vcard = this.contactToVCard(contact);
        const safeName = (contact.name || contact.company || 'contact').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${safeName}.vcf`;
        this.downloadFile(vcard, filename, 'text/vcard');
    },

    /** Download all contacts as a single .vcf file */
    toVCardAll(contacts: Contact[]) {
        const vcards = contacts.map(c => this.contactToVCard(c)).join('');
        this.downloadFile(vcards, `contacts_export_${Date.now()}.vcf`, 'text/vcard');
    },

    downloadFile(content: string, filename: string, mimeType: string) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};
