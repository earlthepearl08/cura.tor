import * as XLSX from 'xlsx';
import { Contact } from '@/types/contact';

export const exportService = {
    toExcel(contacts: Contact[]) {
        const data = contacts.map(c => ({
            Name: c.name,
            Position: c.position,
            Company: c.company,
            Phone: c.phone.join('; '),
            Email: c.email.join('; '),
            Address: c.address,
            Notes: c.notes || '',
            ScannedAt: new Date(c.createdAt).toLocaleString(),
            UpdatedAt: c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
        XLSX.writeFile(workbook, `contacts_export_${Date.now()}.xlsx`);
    },

    toCSV(contacts: Contact[]) {
        const headers = ['Name', 'Position', 'Company', 'Phone', 'Email', 'Address', 'Notes', 'ScannedAt', 'UpdatedAt'];
        const rows = contacts.map(c => [
            c.name,
            c.position,
            c.company,
            c.phone.join('; '),
            c.email.join('; '),
            c.address,
            c.notes || '',
            new Date(c.createdAt).toLocaleString(),
            c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `contacts_export_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /** Generate vCard string for a single contact */
    contactToVCard(contact: Contact): string {
        const nameParts = contact.name.split(' ');
        const lastName = nameParts.length > 1 ? nameParts.pop() : '';
        const firstName = nameParts.join(' ');

        let vcard = 'BEGIN:VCARD\r\nVERSION:3.0\r\n';
        vcard += `N:${lastName};${firstName};;;\r\n`;
        vcard += `FN:${contact.name}\r\n`;

        if (contact.company) {
            vcard += `ORG:${contact.company}\r\n`;
        }
        if (contact.position) {
            vcard += `TITLE:${contact.position}\r\n`;
        }
        for (const phone of contact.phone) {
            vcard += `TEL;TYPE=WORK,VOICE:${phone}\r\n`;
        }
        for (const email of contact.email) {
            vcard += `EMAIL;TYPE=WORK:${email}\r\n`;
        }
        if (contact.address) {
            vcard += `ADR;TYPE=WORK:;;${contact.address};;;;\r\n`;
        }
        if (contact.notes) {
            vcard += `NOTE:${contact.notes.replace(/\n/g, '\\n')}\r\n`;
        }

        vcard += 'END:VCARD\r\n';
        return vcard;
    },

    /** Download a single contact as .vcf */
    toVCard(contact: Contact) {
        const vcard = this.contactToVCard(contact);
        const filename = `${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
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
    }
};
