import { openDB, IDBPDatabase } from 'idb';
import { Contact } from '@/types/contact';

const DB_PREFIX = 'CardScannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';

export class StorageService {
    private db: Promise<IDBPDatabase>;
    private currentUid: string | null = null;

    constructor() {
        // Default DB for unauthenticated state (shouldn't be used in practice)
        this.db = this.openUserDB(null);
    }

    /** Switch to a user-specific database. Each user gets their own IndexedDB. */
    switchUser(uid: string | null) {
        if (uid === this.currentUid) return;
        this.currentUid = uid;
        this.db = this.openUserDB(uid);
    }

    private openUserDB(uid: string | null): Promise<IDBPDatabase> {
        const dbName = uid ? `${DB_PREFIX}_${uid}` : DB_PREFIX;
        return openDB(dbName, DB_VERSION, {
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

    async batchSave(contacts: Contact[]): Promise<void> {
        const db = await this.db;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        for (const contact of contacts) {
            tx.store.put(contact);
        }
        await tx.done;
    }

    async clearAll(): Promise<void> {
        const db = await this.db;
        await db.clear(STORE_NAME);
    }
}

export const storage = new StorageService();
