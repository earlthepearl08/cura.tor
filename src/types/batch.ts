export type ScanType = 'single' | 'multi-card' | 'log-sheet';

export interface Batch {
    id: string;                    // UUID
    name: string;                  // User-defined or auto-generated
    scanType: ScanType;
    scannedAt: number;             // Unix timestamp
    totalContacts: number;         // Total contacts in this batch
    successCount: number;          // Successfully parsed contacts
    errorCount: number;            // Failed/skipped contacts
    thumbnailData?: string;        // Base64 thumbnail of first photo
    isDeleted?: boolean;           // Soft-delete flag (for sync)
    deletedAt?: number;            // When deleted
}

/** Generate a default batch name based on scan type and timestamp */
export const generateBatchName = (scanType: ScanType, timestamp: number, count: number): string => {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const typeLabel = scanType === 'multi-card' ? 'Multi-Card' :
                     scanType === 'log-sheet' ? 'Log Sheet' : 'Single Card';

    return `${typeLabel} Scan - ${dateStr} ${timeStr}`;
};
