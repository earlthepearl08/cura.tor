import { Contact } from '@/types/contact';
import type { BatchMap } from '@/services/export';
import { contactToCrmRow } from '@/services/crmExport';
import { authFetch } from '@/utils/authFetch';

export interface HubSpotExportResult {
    created: number;
    updated: number;
    notesCreated: number;
    skipped?: number;
    errors?: string[];
}

export interface HubSpotSetupError extends Error {
    code: 'hubspot_not_configured' | 'hubspot_export_failed' | 'hubspot_http_error';
    setup?: string[];
}

function toHubSpotPayload(contact: Contact, batchMap?: BatchMap) {
    const row = contactToCrmRow(contact, batchMap);

    const properties: Record<string, string> = {
        firstname: row['First Name'],
        lastname: row['Last Name'] || row['First Name'] || 'Unknown',
        email: row.Email,
        phone: row.Phone,
        mobilephone: row['Mobile Phone'],
        company: row['Company Name'],
        jobtitle: row['Job Title'],
        address: row['Street Address'],
        lifecyclestage: row['Lifecycle Stage'] || 'lead',
    };

    // Strip empties so HubSpot does not clear existing values on upsert
    for (const key of Object.keys(properties)) {
        if (!properties[key]?.trim()) delete properties[key];
    }

    const noteParts: string[] = [];
    if (row.Notes) noteParts.push(row.Notes);
    if (row['Additional Emails']) noteParts.push(`Additional emails: ${row['Additional Emails']}`);
    if (row['Lead Source']) noteParts.push(`Lead source: ${row['Lead Source']}`);
    if (row.Folder) noteParts.push(`Folder: ${row.Folder}`);
    if (row.Batch) noteParts.push(`Batch: ${row.Batch}`);
    if (row['Claimed By']) noteParts.push(`Claimed by: ${row['Claimed By']}`);
    if (row['Contact ID']) noteParts.push(`Cura.Tor contact ID: ${row['Contact ID']}`);
    if (row['Scanned At']) noteParts.push(`Scanned at: ${row['Scanned At']}`);

    return {
        properties,
        noteBody: noteParts.length > 0 ? noteParts.join('\n') : undefined,
    };
}

function asSetupError(body: any, fallback: string): HubSpotSetupError {
    const err = new Error(body?.error || fallback) as HubSpotSetupError;
    err.code = body?.code === 'hubspot_not_configured' ? 'hubspot_not_configured' : 'hubspot_http_error';
    if (Array.isArray(body?.setup)) err.setup = body.setup;
    return err;
}

/**
 * Export contacts to HubSpot CRM via the server stub (`/api/hubspot-export`).
 * Requires Pioneer+ (same gate as CSV export) on the client; server needs HUBSPOT_ACCESS_TOKEN.
 */
export async function exportContactsToHubSpot(
    contacts: Contact[],
    batchMap?: BatchMap
): Promise<HubSpotExportResult> {
    if (contacts.length === 0) {
        throw new Error('No contacts to export');
    }

    const payload = {
        contacts: contacts.map((c) => toHubSpotPayload(c, batchMap)),
    };

    const res = await authFetch('/api/hubspot-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (res.status === 503 || body?.code === 'hubspot_not_configured') {
        throw asSetupError(body, 'HubSpot is not configured. See HUBSPOT.md.');
    }

    if (!res.ok) {
        const detail = Array.isArray(body?.details) ? body.details.join('; ') : '';
        const message = [body?.error || `HubSpot export failed (${res.status})`, detail]
            .filter(Boolean)
            .join(' — ');
        throw asSetupError({ ...body, error: message }, message);
    }

    return {
        created: Number(body.created) || 0,
        updated: Number(body.updated) || 0,
        notesCreated: Number(body.notesCreated) || 0,
        skipped: Number(body.skipped) || 0,
        errors: Array.isArray(body.errors) ? body.errors : [],
    };
}
