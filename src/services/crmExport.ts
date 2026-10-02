import { Contact } from '@/types/contact';
import type { BatchMap } from '@/services/export';

/**
 * CRM-ready column layout shared by Google Sheets export and CRM CSV download.
 * Headers are chosen to map cleanly into HubSpot Contacts and Salesforce Leads/Contacts.
 *
 * See HUBSPOT.md for HubSpot property mapping; CRM CSV/Sheets share this layout.
 */
export const CRM_HEADERS = [
    'First Name',
    'Last Name',
    'Email',
    'Additional Emails',
    'Phone',
    'Mobile Phone',
    'Company Name',
    'Job Title',
    'Street Address',
    'Notes',
    'Lifecycle Stage',
    'Lead Source',
    'Folder',
    'Batch',
    'Claimed By',
    'Scanned At',
    'Updated At',
    'Contact ID',
] as const;

export type CrmHeader = (typeof CRM_HEADERS)[number];
export type CrmRow = Record<CrmHeader, string>;

export function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1],
    };
}

export function contactToCrmRow(contact: Contact, batchMap?: BatchMap): CrmRow {
    const { firstName, lastName } = splitDisplayName(contact.name || '');
    const emails = (contact.email || []).map((e) => e.trim()).filter(Boolean);
    const phones = (contact.phone || []).map((p) => p.trim()).filter(Boolean);

    return {
        'First Name': firstName,
        'Last Name': lastName,
        Email: emails[0] || '',
        'Additional Emails': emails.slice(1).join('; '),
        Phone: phones[0] || '',
        'Mobile Phone': phones[1] || '',
        'Company Name': contact.company || '',
        'Job Title': contact.position || '',
        'Street Address': contact.address || '',
        Notes: contact.notes || '',
        'Lifecycle Stage': 'lead',
        'Lead Source': 'Cura.Tor',
        Folder: contact.folder || 'Uncategorized',
        Batch: (contact.batchId && batchMap?.[contact.batchId]) || '',
        'Claimed By': contact.claimedByName || '',
        'Scanned At': contact.createdAt ? new Date(contact.createdAt).toISOString() : '',
        'Updated At': contact.updatedAt ? new Date(contact.updatedAt).toISOString() : '',
        'Contact ID': contact.id || '',
    };
}

export function contactsToCrmRows(contacts: Contact[], batchMap?: BatchMap): CrmRow[] {
    return contacts.map((c) => contactToCrmRow(c, batchMap));
}

/** 2D values array suitable for Google Sheets `values.update` / CSV rows. */
export function contactsToCrmValueMatrix(contacts: Contact[], batchMap?: BatchMap): string[][] {
    const rows = contactsToCrmRows(contacts, batchMap);
    return [
        [...CRM_HEADERS],
        ...rows.map((row) => CRM_HEADERS.map((header) => row[header])),
    ];
}
