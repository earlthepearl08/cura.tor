import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { Contact } from '@/types/contact';
import { Batch } from '@/types/batch';
import { FieldCorrection } from '@/types/correction';
import { storage as personalStorage } from './storage';

export type SharedWorkspaceKind = 'organization' | 'event';

/**
 * Firestore-backed storage for shared workspaces:
 * - enterprise organizations (`organizations/{id}`)
 * - lightweight event packs (`eventWorkspaces/{id}`)
 *
 * Mirrors the StorageService API so pages can swap between personal
 * (IndexedDB) and shared (Firestore) storage transparently.
 *
 * Real-time: use subscribeContacts / subscribeFolders / subscribeBatches
 * for live claim + presence updates. One-shot getters remain for import
 * flows and personal-mode parity.
 */
export class TeamStorageService {
    private workspaceKind: SharedWorkspaceKind = 'organization';
    private workspaceId: string | null = null;

    /** Switch to a specific organization (enterprise team). */
    setOrganization(orgId: string | null) {
        this.workspaceKind = 'organization';
        this.workspaceId = orgId;
    }

    /** Switch to a lightweight event workspace. */
    setEventWorkspace(eventId: string | null) {
        this.workspaceKind = 'event';
        this.workspaceId = eventId;
    }

    getOrganizationId(): string | null {
        return this.workspaceKind === 'organization' ? this.workspaceId : null;
    }

    getEventWorkspaceId(): string | null {
        return this.workspaceKind === 'event' ? this.workspaceId : null;
    }

    private rootCollection(): 'organizations' | 'eventWorkspaces' {
        return this.workspaceKind === 'event' ? 'eventWorkspaces' : 'organizations';
    }

    private requireWorkspace(): string {
        if (!this.workspaceId) {
            throw new Error(this.workspaceKind === 'event' ? 'No event selected' : 'No organization selected');
        }
        return this.workspaceId;
    }

    private workspaceDoc(...segments: string[]) {
        const id = this.requireWorkspace();
        return doc(db, this.rootCollection(), id, ...segments);
    }

    private workspaceCollection(sub: string) {
        const id = this.requireWorkspace();
        return collection(db, this.rootCollection(), id, sub);
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
            customFields: data.customFields && typeof data.customFields === 'object'
                ? { ...data.customFields }
                : undefined,
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
            claimedBy: data.claimedBy,
            claimedByName: data.claimedByName,
            claimedAt: data.claimedAt instanceof Timestamp ? data.claimedAt.toMillis() : data.claimedAt,
            followUpStatus: data.followUpStatus,
            followUpDueAt: data.followUpDueAt instanceof Timestamp ? data.followUpDueAt.toMillis() : data.followUpDueAt,
            followUpUpdatedAt: data.followUpUpdatedAt instanceof Timestamp
                ? data.followUpUpdatedAt.toMillis()
                : data.followUpUpdatedAt,
        };
    }

    /** Claim a contact as "mine to follow up on". Respects Firestore rules
     *  so only unclaimed contacts can be claimed by regular members. */
    async claimContact(contactId: string): Promise<void> {
        this.requireWorkspace();
        const { uid, displayName } = this.getCurrentUserInfo();
        const ref = this.workspaceDoc('contacts', contactId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Contact not found');
        const data = snap.data();
        if (data.claimedBy && data.claimedBy !== uid) {
            throw new Error(`Already claimed by ${data.claimedByName || 'another member'}`);
        }
        const now = Date.now();
        await setDoc(ref, {
            ...data,
            claimedBy: uid,
            claimedByName: displayName,
            claimedAt: now,
            followUpStatus: 'claimed',
            followUpDueAt: now + 2 * 24 * 60 * 60 * 1000,
            followUpUpdatedAt: now,
        });
    }

    /** Release your own claim on a contact so someone else can pick it up. */
    async releaseClaim(contactId: string): Promise<void> {
        this.requireWorkspace();
        const { uid } = this.getCurrentUserInfo();
        const ref = this.workspaceDoc('contacts', contactId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Contact not found');
        const data = snap.data();
        if (data.claimedBy !== uid) {
            throw new Error('Only the person who claimed this contact can release it');
        }
        const updated = { ...data };
        delete updated.claimedBy;
        delete updated.claimedByName;
        delete updated.claimedAt;
        delete updated.followUpStatus;
        delete updated.followUpDueAt;
        delete updated.followUpUpdatedAt;
        await setDoc(ref, updated);
    }

    /**
     * Org-admin claim override. Pass assignee to reassign (including to self);
     * pass null to force-release. Firestore rules allow this only for org admins.
     * Personal workspace has no claims — this is team-only.
     * Reassign initializes follow-up; force-release clears it.
     */
    async adminOverrideClaim(
        contactId: string,
        assignee: { uid: string; displayName: string } | null
    ): Promise<void> {
        this.requireWorkspace();
        const ref = this.workspaceDoc('contacts', contactId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Contact not found');
        const data = snap.data();

        if (assignee === null) {
            const updated = { ...data };
            delete updated.claimedBy;
            delete updated.claimedByName;
            delete updated.claimedAt;
            delete updated.followUpStatus;
            delete updated.followUpDueAt;
            delete updated.followUpUpdatedAt;
            await setDoc(ref, updated);
            return;
        }

        const now = Date.now();
        await setDoc(ref, {
            ...data,
            claimedBy: assignee.uid,
            claimedByName: assignee.displayName,
            claimedAt: now,
            followUpStatus: 'claimed',
            followUpDueAt: now + 2 * 24 * 60 * 60 * 1000,
            followUpUpdatedAt: now,
        });
    }

    /**
     * Update follow-up pipeline status / due date for a contact you claimed.
     * Clears due date automatically when status is `done`.
     */
    async updateFollowUp(
        contactId: string,
        patch: {
            followUpStatus?: Contact['followUpStatus'];
            followUpDueAt?: number | null;
        }
    ): Promise<void> {
        this.requireWorkspace();
        const { uid } = this.getCurrentUserInfo();
        const ref = this.workspaceDoc('contacts', contactId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Contact not found');
        const data = snap.data();
        if (data.claimedBy !== uid) {
            throw new Error('Only the claimer can update follow-up status');
        }

        const now = Date.now();
        const updated: any = {
            ...data,
            followUpUpdatedAt: now,
            updatedAt: now,
        };

        if (patch.followUpStatus !== undefined) {
            updated.followUpStatus = patch.followUpStatus;
            if (patch.followUpStatus === 'done') {
                delete updated.followUpDueAt;
            }
        }

        if (patch.followUpDueAt !== undefined) {
            if (patch.followUpDueAt === null) {
                delete updated.followUpDueAt;
            } else {
                updated.followUpDueAt = patch.followUpDueAt;
            }
        }

        Object.keys(updated).forEach((k) => updated[k] === undefined && delete updated[k]);
        await setDoc(ref, updated);
    }

    /** Remove base64 image fields — shared workspace stores parsed data only */
    private stripImages<T extends Record<string, any>>(data: T): T {
        const clone: any = { ...data };
        delete clone.imageData;
        delete clone.personPhoto;
        delete clone.locationPhoto;
        return clone;
    }

    async getAllContacts(): Promise<Contact[]> {
        this.requireWorkspace();
        const snap = await getDocs(this.workspaceCollection('contacts'));
        return snap.docs.map(d => this.docToContact(d.data(), d.id));
    }

    /**
     * Live subscription to shared-workspace contacts (claims, edits, adds, deletes).
     * Returns an unsubscribe function — call it on unmount / workspace switch.
     */
    subscribeContacts(
        onUpdate: (contacts: Contact[]) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        this.requireWorkspace();
        return onSnapshot(
            this.workspaceCollection('contacts'),
            (snap) => {
                onUpdate(snap.docs.map(d => this.docToContact(d.data(), d.id)));
            },
            (err) => {
                console.error('Team contacts subscription error:', err);
                onError?.(err);
            },
        );
    }

    /** Live subscription to shared-workspace folder names */
    subscribeFolders(
        onUpdate: (folders: string[]) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        this.requireWorkspace();
        return onSnapshot(
            this.workspaceCollection('folders'),
            (snap) => {
                onUpdate(snap.docs.map(d => d.id));
            },
            (err) => {
                console.error('Team folders subscription error:', err);
                onError?.(err);
            },
        );
    }

    /** Live subscription to shared-workspace batches */
    subscribeBatches(
        onUpdate: (batches: Batch[]) => void,
        onError?: (error: Error) => void,
    ): Unsubscribe {
        this.requireWorkspace();
        return onSnapshot(
            this.workspaceCollection('batches'),
            (snap) => {
                onUpdate(
                    snap.docs
                        .map(d => this.docToBatch(d.data(), d.id))
                        .sort((a, b) => b.scannedAt - a.scannedAt),
                );
            },
            (err) => {
                console.error('Team batches subscription error:', err);
                onError?.(err);
            },
        );
    }

    /** Parity with StorageService — shared contacts are hard-deleted, so this is the same as getAllContacts */
    async getAllContactsIncludingDeleted(): Promise<Contact[]> {
        return this.getAllContacts();
    }

    async saveContact(contact: Contact): Promise<void> {
        this.requireWorkspace();
        const { uid, displayName } = this.getCurrentUserInfo();

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

        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

        await setDoc(this.workspaceDoc('contacts', contact.id), data);

        try {
            await personalStorage.saveContact({
                ...contact,
                createdBy: data.createdBy ?? contact.createdBy,
                createdByName: data.createdByName ?? contact.createdByName,
                lastEditedBy: data.lastEditedBy ?? contact.lastEditedBy,
                lastEditedByName: data.lastEditedByName ?? contact.lastEditedByName,
                updatedAt: data.updatedAt,
            });
        } catch (err) {
            console.warn('Personal archive write failed (shared save succeeded):', err);
        }
    }

    async deleteContact(id: string): Promise<void> {
        this.requireWorkspace();
        await deleteDoc(this.workspaceDoc('contacts', id));
    }

    async hardDeleteContact(id: string): Promise<void> {
        return this.deleteContact(id);
    }

    async getDeletedContacts(): Promise<Contact[]> {
        return [];
    }

    async restoreContact(_id: string): Promise<void> {
        // No tombstones in shared workspace
    }

    async purgeTombstones(_maxAgeMs?: number): Promise<number> {
        return 0;
    }

    async batchSave(contacts: Contact[]): Promise<void> {
        for (const contact of contacts) {
            await this.saveContact(contact);
        }
    }

    async clearAll(): Promise<void> {
        this.requireWorkspace();
        const snap = await getDocs(this.workspaceCollection('contacts'));
        for (const d of snap.docs) {
            await deleteDoc(d.ref);
        }
    }

    async getAllFolders(): Promise<string[]> {
        this.requireWorkspace();
        const snap = await getDocs(this.workspaceCollection('folders'));
        return snap.docs.map(d => d.id);
    }

    async saveFolder(name: string): Promise<void> {
        this.requireWorkspace();
        await setDoc(this.workspaceDoc('folders', name), {
            name,
            createdAt: serverTimestamp(),
        });
    }

    async deleteFolder(name: string): Promise<void> {
        this.requireWorkspace();
        await deleteDoc(this.workspaceDoc('folders', name));
    }

    async batchUpdateFolder(ids: string[], folder: string): Promise<void> {
        this.requireWorkspace();
        const { uid, displayName } = this.getCurrentUserInfo();
        for (const id of ids) {
            const ref = this.workspaceDoc('contacts', id);
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

    async migrateFromLegacyDB(): Promise<number> {
        return 0;
    }

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
        this.requireWorkspace();
        const snap = await getDocs(this.workspaceCollection('batches'));
        return snap.docs
            .map(d => this.docToBatch(d.data(), d.id))
            .sort((a, b) => b.scannedAt - a.scannedAt);
    }

    async getBatch(id: string): Promise<Batch | undefined> {
        this.requireWorkspace();
        const snap = await getDoc(this.workspaceDoc('batches', id));
        return snap.exists() ? this.docToBatch(snap.data(), snap.id) : undefined;
    }

    async saveBatch(batch: Batch): Promise<void> {
        this.requireWorkspace();
        const data: any = { ...batch };
        delete data.thumbnailData;
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await setDoc(this.workspaceDoc('batches', batch.id), data);
    }

    async deleteBatch(id: string): Promise<void> {
        this.requireWorkspace();
        await deleteDoc(this.workspaceDoc('batches', id));
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

    /** Org-shared OCR correction glossary */
    async getAllCorrections(): Promise<FieldCorrection[]> {
        this.requireWorkspace();
        const snap = await getDocs(this.workspaceCollection('corrections'));
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                field: data.field,
                from: data.from || '',
                fromNorm: data.fromNorm || '',
                to: data.to || '',
                scope: 'org' as const,
                learnCount: data.learnCount || 1,
                hitCount: data.hitCount || 0,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
                createdBy: data.createdBy,
            } satisfies FieldCorrection;
        });
    }

    async saveCorrection(correction: FieldCorrection): Promise<void> {
        this.requireWorkspace();
        const { uid } = this.getCurrentUserInfo();
        const data: Record<string, unknown> = {
            ...correction,
            scope: 'org',
            createdBy: correction.createdBy || uid,
            updatedAt: Date.now(),
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await setDoc(this.workspaceDoc('corrections', correction.id), data);
    }

    async deleteCorrection(id: string): Promise<void> {
        this.requireWorkspace();
        await deleteDoc(this.workspaceDoc('corrections', id));
    }
}

export const teamStorage = new TeamStorageService();
