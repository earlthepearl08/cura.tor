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
    }
};
