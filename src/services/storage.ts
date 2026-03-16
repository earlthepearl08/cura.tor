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

    /** Get all active (non-deleted) contacts */
    async getAllContacts(): Promise<Contact[]> {
        const db = await this.db;
        const all: Contact[] = await db.getAll(STORE_NAME);
        return all.filter(c => !c.isDeleted);
    }

    /** Get all contacts including soft-deleted tombstones (used by sync) */
    async getAllContactsIncludingDeleted(): Promise<Contact[]> {
        const db = await this.db;
        return db.getAll(STORE_NAME);
    }

    async saveContact(contact: Contact): Promise<void> {
        const db = await this.db;
        await db.put(STORE_NAME, contact);
    }

    /** Soft-delete: marks contact as deleted (tombstone) so sync can propagate the deletion */
    async deleteContact(id: string): Promise<void> {
        const db = await this.db;
        const contact = await db.get(STORE_NAME, id);
        if (contact) {
            contact.isDeleted = true;
            contact.deletedAt = Date.now();
            contact.updatedAt = Date.now();
            // Strip heavy data from tombstone to save space
            contact.imageData = '';
            contact.rawText = '';
            contact.personPhoto = undefined;
            contact.locationPhoto = undefined;
            await db.put(STORE_NAME, contact);
        }
    }

    /** Hard-delete: permanently removes a contact record (used after sync propagation) */
    async hardDeleteContact(id: string): Promise<void> {
        const db = await this.db;
        await db.delete(STORE_NAME, id);
    }

    /** Get all soft-deleted contacts (recently deleted, recoverable) */
    async getDeletedContacts(): Promise<Contact[]> {
        const db = await this.db;
        const all: Contact[] = await db.getAll(STORE_NAME);
        return all.filter(c => c.isDeleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    }

    /** Restore a soft-deleted contact (un-delete) */
    async restoreContact(id: string): Promise<void> {
        const db = await this.db;
        const contact = await db.get(STORE_NAME, id);
        if (contact && contact.isDeleted) {
            contact.isDeleted = false;
            contact.deletedAt = undefined;
            contact.updatedAt = Date.now();
            await db.put(STORE_NAME, contact);
        }
    }

    /** Remove tombstones older than the given age (default 30 days) */
    async purgeTombstones(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
        const db = await this.db;
        const all: Contact[] = await db.getAll(STORE_NAME);
        const cutoff = Date.now() - maxAgeMs;
        const toDelete = all.filter(c => c.isDeleted && c.deletedAt && c.deletedAt < cutoff);
        if (toDelete.length > 0) {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            for (const c of toDelete) {
                tx.store.delete(c.id);
            }
            await tx.done;
        }
        return toDelete.length;
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
        return this.migrateFromDB(DB_PREFIX);
    }

    /** Batch update folder for multiple contacts (used by bulk move) */
    async batchUpdateFolder(ids: string[], folder: string): Promise<void> {
        const db = await this.db;
        const tx = db.transaction(STORE_NAME, 'readwrite');
        for (const id of ids) {
            const contact = await tx.store.get(id);
            if (contact) {
                contact.folder = folder;
                contact.updatedAt = Date.now();
                tx.store.put(contact);
            }
        }
        await tx.done;
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
