import { useState, useEffect } from 'react';
import { Contact } from '@/types/contact';
import { Batch } from '@/types/batch';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { TeamStorageService } from '@/services/teamStorage';

function isTeamStorage(storage: unknown): storage is TeamStorageService {
    return !!storage && typeof storage === 'object' && 'subscribeContacts' in storage;
}

export interface UseTeamContactsResult {
    /** Contacts when live; empty when not in team mode (caller should load personal separately). */
    contacts: Contact[];
    folders: string[];
    batches: Batch[];
    isLoading: boolean;
    error: string | null;
    /** True once the first snapshot has arrived and the listener is active. */
    isLive: boolean;
}

/**
 * Live Firestore listeners for team workspace contacts, folders, and batches.
 * No-ops (returns empty + isLive false) when not in team mode.
 */
export function useTeamContacts(): UseTeamContactsResult {
    const { mode, storage, organization } = useWorkspace();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);

    const orgId = organization?.id;
    const isTeamMode = mode === 'team' && !!orgId && isTeamStorage(storage);

    useEffect(() => {
        if (!isTeamMode || !isTeamStorage(storage)) {
            setContacts([]);
            setFolders([]);
            setBatches([]);
            setIsLive(false);
            setIsLoading(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        let contactsReady = false;
        let foldersReady = false;
        let batchesReady = false;

        const maybeReady = () => {
            if (contactsReady && foldersReady && batchesReady) {
                setIsLoading(false);
                setIsLive(true);
            }
        };

        const unsubContacts = storage.subscribeContacts(
            (data) => {
                setContacts([...data].sort((a, b) => b.createdAt - a.createdAt));
                contactsReady = true;
                maybeReady();
            },
            (err) => {
                setError(err.message || 'Failed to sync team contacts');
                setIsLoading(false);
                setIsLive(false);
            },
        );

        const unsubFolders = storage.subscribeFolders(
            (data) => {
                setFolders(data);
                foldersReady = true;
                maybeReady();
            },
            (err) => {
                console.warn('Team folders sync error:', err);
                foldersReady = true;
                maybeReady();
            },
        );

        const unsubBatches = storage.subscribeBatches(
            (data) => {
                setBatches(data);
                batchesReady = true;
                maybeReady();
            },
            (err) => {
                console.warn('Team batches sync error:', err);
                batchesReady = true;
                maybeReady();
            },
        );

        return () => {
            unsubContacts();
            unsubFolders();
            unsubBatches();
            setIsLive(false);
        };
    }, [isTeamMode, orgId, storage]);

    return { contacts, folders, batches, isLoading, error, isLive };
}
