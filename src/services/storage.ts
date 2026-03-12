import { openDB, IDBPDatabase } from 'idb';
import { Contact } from '@/types/contact';

const DB_PREFIX = 'CardScannerDB';
const DB_VERSION = 2;
const STORE_NAME = 'contacts';
const FOLDERS_STORE = 'folders';

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
            upgrade(db, oldVersion) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
                        db.createObjectStore(FOLDERS_STORE, { keyPath: 'name' });
                    }
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

    async getAllFolders(): Promise<string[]> {
        const db = await this.db;
        const records = await db.getAll(FOLDERS_STORE);
        return records.map((r: any) => r.name);
    }

    async saveFolder(name: string): Promise<void> {
        const db = await this.db;
        await db.put(FOLDERS_STORE, { name });
    }

    async deleteFolder(name: string): Promise<void> {
        const db = await this.db;
        await db.delete(FOLDERS_STORE, name);
    }

    /** One-time migration: copy contacts from the old shared DB into the current user's DB, then clear the old one. */
    async migrateFromLegacyDB(): Promise<number> {
        if (!this.currentUid) return 0;

        let total = 0;

        // Migrate from the old shared (no-UID) DB
        total += await this.migrateFromDB(DB_PREFIX);

        // One-time fix: contacts were accidentally migrated to wrong account.
        // Copy them from that account's DB to the current user, then clean up.
        const WRONG_UID = '5disr5WXONYXDCe6l2ONfduk2Ht2';
        const TARGET_UID = 'sNu5XECxkQfddPQXxuuOw9YFn2n2';
        if (this.currentUid === TARGET_UID) {
            total += await this.migrateFromDB(`${DB_PREFIX}_${WRONG_UID}`);
        }

        return total;
    }

    private async migrateFromDB(dbName: string): Promise<number> {
        try {
            const sourceDb = await openDB(dbName, DB_VERSION, {
                upgrade(db, oldVersion) {
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                    if (oldVersion < 2) {
                        if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
                            db.createObjectStore(FOLDERS_STORE, { keyPath: 'name' });
                        }
                    }
                },
            });

            const contacts: Contact[] = await sourceDb.getAll(STORE_NAME);
            if (contacts.length === 0) {
                sourceDb.close();
                return 0;
            }

            await this.batchSave(contacts);
            await sourceDb.clear(STORE_NAME);
            sourceDb.close();

            console.log(`Migrated ${contacts.length} contacts from ${dbName}`);
            return contacts.length;
        } catch (err) {
            console.error(`Migration from ${dbName} failed:`, err);
            return 0;
        }
    }
}

export const storage = new StorageService();
