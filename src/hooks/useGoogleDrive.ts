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

export const useGoogleDrive = () => {
  const { canUseGoogleDrive } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDrive = async () => {
      try {
        await googleDrive.init();
        const state = googleDrive.getState();
        setIsConnected(state.isSignedIn);
        setUser(state.user);
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
      setError('Google Drive sync requires a Pro or Early Access plan');
      return 0;
    }
    try {
      setIsSyncing(true);
      setError(null);

      // Load both sides (including tombstones for proper sync)
      const localContacts = await storage.getAllContactsIncludingDeleted();
      let driveContacts: Contact[] = [];
      try {
        driveContacts = await googleDrive.loadContacts();
      } catch (err) {
        // First sync or no file on Drive yet — that's fine
        console.log('[Sync] No existing Drive data, will push local contacts');
      }

      // Merge (includes tombstones)
      const merged = mergeContacts(localContacts, driveContacts);

      // Save merged result to local (including tombstones)
      await storage.batchSave(merged);

      // Save only non-deleted contacts to Drive (no need to store tombstones on Drive)
      // But we DO save tombstones to Drive so other devices can pick up deletions
      await googleDrive.saveContacts(merged);

      // Purge old tombstones (> 30 days) from local storage
      const purged = await storage.purgeTombstones();
      if (purged > 0) {
        console.log(`[Sync] Purged ${purged} old tombstones`);
      }

      // Update last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('lastDriveSync', now.toString());

      // Return count of active (non-deleted) contacts
      return merged.filter(c => !c.isDeleted).length;
    } catch (err: any) {
      setError(err.message || 'Failed to sync contacts');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [canUseGoogleDrive]);

  const connect = useCallback(async () => {
    if (!canUseGoogleDrive()) {
      setError('Google Drive sync requires a Pro or Early Access plan');
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
    localStorage.removeItem('lastDriveSync');
  }, []);

  return {
    isConnected,
    user,
    isSyncing,
    lastSyncTime,
    error,
    connect,
    disconnect,
    syncContacts,
  };
};
