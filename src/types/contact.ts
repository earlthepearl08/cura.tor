export interface Contact {
    id: string;
    name: string;
    position: string;
    company: string;
    phone: string[];      // Multiple numbers
    email: string[];      // Multiple emails
    address: string;
    notes: string;        // User notes (e.g., what they're inquiring about)
    folder?: string;      // Folder/group name (default: "Uncategorized")
    rawText: string;      // Original OCR output
    imageData: string;    // Base64 image
    confidence: number;   // 0-100
    isVerified: boolean;
    createdAt: number;    // Unix timestamp
    updatedAt?: number;   // Unix timestamp for last edit
}
