import { openDB, IDBPDatabase } from 'idb';
import { Contact } from '@/types/contact';

const DB_NAME = 'CardScannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';

export class StorageService {
    private db: Promise<IDBPDatabase>;

    constructor() {
        this.db = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }

    async getAllContacts(): Promise<Contact[]> {
        const db = await this.db;
        return db.getAll(STORE_NAME);
    }

    async saveContact(contact: Contact): Promise<void> {
        const db = await this.db;
        await db.put(STORE_NAME, contact);
    }

    async deleteContact(id: string): Promise<void> {
        const db = await this.db;
        await db.delete(STORE_NAME, id);
    }

    async clearAll(): Promise<void> {
        const db = await this.db;
        await db.clear(STORE_NAME);
    }
}

export const storage = new StorageService();
