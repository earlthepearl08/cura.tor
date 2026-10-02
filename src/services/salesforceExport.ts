import { Contact } from '@/types/contact';
import type { BatchMap } from '@/services/export';

/**
 * Salesforce Data Import Wizard / Data Loader column headers.
 * Uses Salesforce API field names so the Import Wizard auto-maps most columns.
 *
 * Companion to the HubSpot-oriented CRM-ready CSV in PR #8 (`crmExport.ts`).
 * See SALESFORCE_EXPORT.md for Import Wizard steps and object notes.
 */
export const SALESFORCE_HEADERS = [
    'FirstName',
    'LastName',
    'Company',
    'Title',
    'Email',
    'Phone',
    'MobilePhone',
    'Street',
    'Description',
    'LeadSource',
    'CuraTor_Contact_Id__c',
] as const;

export type SalesforceHeader = (typeof SALESFORCE_HEADERS)[number];
export type SalesforceRow = Record<SalesforceHeader, string>;

export function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1],
    };
}

/**
 * Build one Salesforce-friendly row.
 * Lead imports require LastName + Company — we fill safe fallbacks when missing.
 */
export function contactToSalesforceRow(contact: Contact, batchMap?: BatchMap): SalesforceRow {
    const { firstName, lastName } = splitDisplayName(contact.name || '');
    const emails = (contact.email || []).map((e) => e.trim()).filter(Boolean);
    const phones = (contact.phone || []).map((p) => p.trim()).filter(Boolean);
    const company = (contact.company || '').trim();

    const safeLastName = lastName || company || firstName || 'Unknown';
    const safeCompany = company || lastName || firstName || 'Unknown';

    const metaBits: string[] = [];
    if (emails.length > 1) metaBits.push(`Additional emails: ${emails.slice(1).join('; ')}`);
    if (contact.folder) metaBits.push(`Folder: ${contact.folder}`);
    if (contact.batchId && batchMap?.[contact.batchId]) {
        metaBits.push(`Batch: ${batchMap[contact.batchId]}`);
    }
    if (contact.claimedByName) metaBits.push(`Claimed by: ${contact.claimedByName}`);
    if (contact.notes) metaBits.push(contact.notes);

    return {
        FirstName: firstName === safeLastName && !lastName ? '' : firstName,
        LastName: safeLastName,
        Company: safeCompany,
        Title: contact.position || '',
        Email: emails[0] || '',
        Phone: phones[0] || '',
        MobilePhone: phones[1] || '',
        Street: contact.address || '',
        Description: metaBits.join('\n'),
        LeadSource: 'Cura.Tor',
        CuraTor_Contact_Id__c: contact.id || '',
    };
}

export function contactsToSalesforceRows(contacts: Contact[], batchMap?: BatchMap): SalesforceRow[] {
    return contacts.map((c) => contactToSalesforceRow(c, batchMap));
}

/** Header + value matrix for CSV download. */
export function contactsToSalesforceValueMatrix(contacts: Contact[], batchMap?: BatchMap): string[][] {
    const rows = contactsToSalesforceRows(contacts, batchMap);
    return [
        [...SALESFORCE_HEADERS],
        ...rows.map((row) => SALESFORCE_HEADERS.map((header) => row[header])),
    ];
}
