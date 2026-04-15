import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { Contact } from '@/types/contact';
import { Batch } from '@/types/batch';

/**
 * Firestore-backed storage for team/organization workspaces.
 * Mirrors the StorageService API surface so pages can swap between
 * personal (IndexedDB) and team (Firestore) storage transparently.
 *
 * Note: No real-time onSnapshot in MVP — manual refresh only.
 */
export class TeamStorageService {
    private orgId: string | null = null;

    /** Switch to a specific organization */
    setOrganization(orgId: string | null) {
        this.orgId = orgId;
    }

    getOrganizationId(): string | null {
        return this.orgId;
    }

    private requireOrg(): string {
        if (!this.orgId) {
            throw new Error('No organization selected');
        }
        return this.orgId;
    }

    private getCurrentUserInfo(): { uid: string; displayName: string } {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');
        return {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Member',
        };
    }

    /** Convert Firestore doc data to Contact (handles Timestamp → number) */
    private docToContact(data: any, id: string): Contact {
        return {
            id,
            name: data.name || '',
            position: data.position || '',
            company: data.company || '',
            phone: data.phone || [],
            email: data.email || [],
            address: data.address || '',
            notes: data.notes || '',
            folder: data.folder,
            rawText: data.rawText || '',
            imageData: '',
            confidence: data.confidence || 0,
            isVerified: data.isVerified || false,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt,
            batchId: data.batchId,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            lastEditedBy: data.lastEditedBy,
            lastEditedByName: data.lastEditedByName,
        };
    }

    /** Remove base64 image fields — team workspace stores parsed data only to keep docs small and reduce legal surface */
    private stripImages<T extends Record<string, any>>(data: T): T {
        const clone: any = { ...data };
        delete clone.imageData;
        delete clone.personPhoto;
        delete clone.locationPhoto;
        return clone;
    }

    /** Get all contacts in active org */
    async getAllContacts(): Promise<Contact[]> {
        const orgId = this.requireOrg();
        const snap = await getDocs(collection(db, 'organizations', orgId, 'contacts'));
        return snap.docs.map(d => this.docToContact(d.data(), d.id));
    }

    /** Parity with StorageService — team contacts are hard-deleted, so this is the same as getAllContacts */
    async getAllContactsIncludingDeleted(): Promise<Contact[]> {
        return this.getAllContacts();
    }

    /** Save a contact to the team workspace */
    async saveContact(contact: Contact): Promise<void> {
        const orgId = this.requireOrg();
        const { uid, displayName } = this.getCurrentUserInfo();

        // Stamp createdBy on first save, lastEditedBy on subsequent saves
        const isNew = !contact.createdBy;
        const data: any = this.stripImages({
            ...contact,
            updatedAt: Date.now(),
        });
        if (isNew) {
            data.createdBy = uid;
            data.createdByName = displayName;
        } else {
            data.lastEditedBy = uid;
            data.lastEditedByName = displayName;
        }

        // Strip undefined fields (Firestore rejects undefined)
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

        await setDoc(doc(db, 'organizations', orgId, 'contacts', contact.id), data);
    }

    /** Hard-delete a contact from the team workspace */
    async deleteContact(id: string): Promise<void> {
        const orgId = this.requireOrg();
        await deleteDoc(doc(db, 'organizations', orgId, 'contacts', id));
    }

    /** Parity with StorageService — same as deleteContact for team workspace */
    async hardDeleteContact(id: string): Promise<void> {
        return this.deleteContact(id);
    }

    /** Parity with StorageService — no-op for team workspace (hard-delete only, no tombstones) */
    async getDeletedContacts(): Promise<Contact[]> {
        return [];
    }

    /** Parity with StorageService — no-op for team workspace */
    async restoreContact(_id: string): Promise<void> {
        // No tombstones in team workspace
    }

    /** Parity with StorageService — no-op for team workspace */
    async purgeTombstones(_maxAgeMs?: number): Promise<number> {
        return 0;
    }

    /** Bulk save (used by import flows) */
    async batchSave(contacts: Contact[]): Promise<void> {
        for (const contact of contacts) {
            await this.saveContact(contact);
        }
    }

    /** Clear all contacts (admin action — used carefully) */
    async clearAll(): Promise<void> {
        const orgId = this.requireOrg();
        const snap = await getDocs(collection(db, 'organizations', orgId, 'contacts'));
        for (const d of snap.docs) {
            await deleteDoc(d.ref);
        }
    }

    /** Get all folders */
    async getAllFolders(): Promise<string[]> {
        const orgId = this.requireOrg();
        const snap = await getDocs(collection(db, 'organizations', orgId, 'folders'));
        return snap.docs.map(d => d.id);
    }

    async saveFolder(name: string): Promise<void> {
        const orgId = this.requireOrg();
        await setDoc(doc(db, 'organizations', orgId, 'folders', name), {
            name,
            createdAt: serverTimestamp(),
        });
    }

    async deleteFolder(name: string): Promise<void> {
        const orgId = this.requireOrg();
        await deleteDoc(doc(db, 'organizations', orgId, 'folders', name));
    }

    /** Bulk update folder for multiple contacts */
    async batchUpdateFolder(ids: string[], folder: string): Promise<void> {
        const orgId = this.requireOrg();
        const { uid, displayName } = this.getCurrentUserInfo();
        for (const id of ids) {
            const ref = doc(db, 'organizations', orgId, 'contacts', id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                await setDoc(ref, this.stripImages({
                    ...snap.data(),
                    folder,
                    updatedAt: Date.now(),
                    lastEditedBy: uid,
                    lastEditedByName: displayName,
                }));
            }
        }
    }

    /** No-op for parity (team contacts don't have legacy DB to migrate from) */
    async migrateFromLegacyDB(): Promise<number> {
        return 0;
    }

    /** Convert Firestore doc data to Batch */
    private docToBatch(data: any, id: string): Batch {
        return {
            id,
            name: data.name || '',
            scanType: data.scanType || 'single',
            scannedAt: data.scannedAt instanceof Timestamp ? data.scannedAt.toMillis() : (data.scannedAt || Date.now()),
            totalContacts: data.totalContacts || 0,
            successCount: data.successCount || 0,
            errorCount: data.errorCount || 0,
            thumbnailData: data.thumbnailData,
        };
    }

    async getAllBatches(): Promise<Batch[]> {
        const orgId = this.requireOrg();
        const snap = await getDocs(collection(db, 'organizations', orgId, 'batches'));
        return snap.docs
            .map(d => this.docToBatch(d.data(), d.id))
            .sort((a, b) => b.scannedAt - a.scannedAt);
    }

    async getBatch(id: string): Promise<Batch | undefined> {
        const orgId = this.requireOrg();
        const snap = await getDoc(doc(db, 'organizations', orgId, 'batches', id));
        return snap.exists() ? this.docToBatch(snap.data(), snap.id) : undefined;
    }

    async saveBatch(batch: Batch): Promise<void> {
        const orgId = this.requireOrg();
        const data: any = { ...batch };
        delete data.thumbnailData;
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await setDoc(doc(db, 'organizations', orgId, 'batches', batch.id), data);
    }

    async deleteBatch(id: string): Promise<void> {
        const orgId = this.requireOrg();
        await deleteDoc(doc(db, 'organizations', orgId, 'batches', id));
    }

    async getContactsByBatchId(batchId: string): Promise<Contact[]> {
        const all = await this.getAllContacts();
        return all.filter(c => c.batchId === batchId);
    }

    async getBatchStats(batchId: string): Promise<{ total: number; verified: number }> {
        const contacts = await this.getContactsByBatchId(batchId);
        return {
            total: contacts.length,
            verified: contacts.filter(c => c.isVerified).length,
        };
    }
}

export const teamStorage = new TeamStorageService();
