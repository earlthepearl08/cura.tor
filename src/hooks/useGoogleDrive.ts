import { useState, useEffect, useCallback } from 'react';
import { googleDrive } from '@/services/googleDrive';
import { storage } from '@/services/storage';
import { useAuth } from '@/contexts/AuthContext';
import { Contact } from '@/types/contact';

/** Get the effective timestamp for a contact (updatedAt if set, otherwise createdAt) */
const getTimestamp = (c: Contact): number => c.updatedAt || c.createdAt || 0;

/**
 * Two-way merge with soft-delete support.
 * - Contacts with the same ID: keep the version with the newer timestamp
 * - If the newer version is deleted (tombstone), mark it deleted in merged result
 * - Contacts only in local: keep them
 * - Contacts only in Drive: add them (unless they are tombstones)
 * Returns the merged array (includes tombstones so they propagate to Drive).
 */
const mergeContacts = (local: Contact[], drive: Contact[]): Contact[] => {
  const merged = new Map<string, Contact>();

  // Add all local contacts first (including tombstones)
  for (const c of local) {
    merged.set(c.id, c);
  }

  // Merge Drive contacts
  for (const driveContact of drive) {
    const localContact = merged.get(driveContact.id);
    if (!localContact) {
      // Only on Drive — add it (tombstones from Drive are kept to propagate)
      merged.set(driveContact.id, driveContact);
    } else {
      // Exists in both — keep the newer version
      if (getTimestamp(driveContact) > getTimestamp(localContact)) {
        merged.set(driveContact.id, driveContact);
      }
    }
  }

  return Array.from(merged.values());
};

export interface SyncProgress {
  step: 'loading-local' | 'loading-cloud' | 'merging' | 'saving-local' | 'saving-cloud' | 'cleanup' | 'done';
  percent: number;
  label: string;
}

export const useGoogleDrive = () => {
  const { canUseGoogleDrive } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDrive = async () => {
      try {
        // Check if Firebase sign-in already provided a Drive token
        const state = googleDrive.getState();
        if (state.isSignedIn) {
          setIsConnected(true);
          setUser(state.user);
        }

        // Initialize GIS/GAPI in background (needed for token refresh)
        await googleDrive.init();

        // Re-check state after init (GIS may have updated it)
        const updatedState = googleDrive.getState();
        setIsConnected(updatedState.isSignedIn);
        setUser(updatedState.user);
      } catch (err) {
        console.error('Failed to initialize Google Drive:', err);
      }
    };

    initDrive();

    // Load last sync time from localStorage
    const savedSyncTime = localStorage.getItem('lastDriveSync');
    if (savedSyncTime) {
      setLastSyncTime(parseInt(savedSyncTime));
    }
  }, []);

  const syncContacts = useCallback(async () => {
    if (!canUseGoogleDrive()) {
      setError('Google Drive sync requires a Pioneer or Pro plan');
      return 0;
    }
    try {
      setIsSyncing(true);
      setError(null);

      // Step 1: Load local contacts
      setSyncProgress({ step: 'loading-local', percent: 10, label: 'Loading local contacts...' });
      const localContacts = await storage.getAllContactsIncludingDeleted();

      // Step 2: Load cloud contacts
      setSyncProgress({ step: 'loading-cloud', percent: 30, label: 'Loading cloud contacts...' });
      let driveContacts: Contact[] = [];
      try {
        driveContacts = await googleDrive.loadContacts();
      } catch (err: any) {
        // First sync, no file on Drive, or download timed out (large legacy file)
        const isTimeout = err?.name === 'AbortError';
        console.log(`[Sync] ${isTimeout ? 'Download timed out — will overwrite with local data' : 'No existing Drive data, will push local contacts'}`);
      }

      // Step 3: Merge
      setSyncProgress({ step: 'merging', percent: 50, label: 'Merging contacts...' });
      const merged = mergeContacts(localContacts, driveContacts);

      // Step 4: Save locally
      setSyncProgress({ step: 'saving-local', percent: 65, label: 'Saving locally...' });
      await storage.batchSave(merged);

      // Step 5: Save to cloud
      setSyncProgress({ step: 'saving-cloud', percent: 80, label: 'Saving to cloud...' });
      await googleDrive.saveContacts(merged);

      // Step 6: Cleanup
      setSyncProgress({ step: 'cleanup', percent: 92, label: 'Cleaning up...' });
      const purged = await storage.purgeTombstones();
      if (purged > 0) {
        console.log(`[Sync] Purged ${purged} old tombstones`);
      }

      // Done
      const activeCount = merged.filter(c => !c.isDeleted).length;
      setSyncProgress({ step: 'done', percent: 100, label: `Synced ${activeCount} contacts` });

      // Update last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('lastDriveSync', now.toString());

      // Clear progress after a brief delay
      setTimeout(() => setSyncProgress(null), 2500);

      return activeCount;
    } catch (err: any) {
      setSyncProgress(null);
      // If session expired, mark as disconnected so UI updates
      if (err.message?.includes('expired') || err.message?.includes('Not signed in')) {
        setIsConnected(false);
        setUser(null);
      }
      setError(err.message || 'Failed to sync contacts');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [canUseGoogleDrive]);

  const connect = useCallback(async () => {
    if (!canUseGoogleDrive()) {
      setError('Google Drive sync requires a Pioneer or Pro plan');
      return;
    }
    try {
      setError(null);
      await googleDrive.signIn();
      const state = googleDrive.getState();
      setIsConnected(state.isSignedIn);
      setUser(state.user);

      // Auto-sync after connecting (two-way merge)
      await syncContacts();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Google Drive');
      throw err;
    }
  }, [syncContacts, canUseGoogleDrive]);

  const disconnect = useCallback(() => {
    googleDrive.signOut();
    setIsConnected(false);
    setUser(null);
    setLastSyncTime(null);
    setSyncProgress(null);
    localStorage.removeItem('lastDriveSync');
  }, []);

  return {
    isConnected,
    user,
    isSyncing,
    syncProgress,
    lastSyncTime,
    error,
    connect,
    disconnect,
    syncContacts,
  };
};
