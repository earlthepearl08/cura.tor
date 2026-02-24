import { useState, useEffect, useCallback } from 'react';
import { googleDrive } from '@/services/googleDrive';
import { storage } from '@/services/storage';
import { Contact } from '@/types/contact';

/** Get the effective timestamp for a contact (updatedAt if set, otherwise createdAt) */
const getTimestamp = (c: Contact): number => c.updatedAt || c.createdAt || 0;

/**
 * Two-way merge: combines local and Drive contacts.
 * - Contacts with the same ID: keep the version with the newer timestamp
 * - Contacts only in local: keep them
 * - Contacts only in Drive: add them
 * Returns the merged array.
 */
const mergeContacts = (local: Contact[], drive: Contact[]): Contact[] => {
  const merged = new Map<string, Contact>();

  // Add all local contacts first
  for (const c of local) {
    merged.set(c.id, c);
  }

  // Merge Drive contacts
  for (const driveContact of drive) {
    const localContact = merged.get(driveContact.id);
    if (!localContact) {
      // Only on Drive — add it
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
    try {
      setIsSyncing(true);
      setError(null);

      // Load both sides
      const localContacts = await storage.getAllContacts();
      let driveContacts: Contact[] = [];
      try {
        driveContacts = await googleDrive.loadContacts();
      } catch (err) {
        // First sync or no file on Drive yet — that's fine
        console.log('[Sync] No existing Drive data, will push local contacts');
      }

      // Merge
      const merged = mergeContacts(localContacts, driveContacts);

      // Save merged result to both local and Drive
      await storage.batchSave(merged);
      await googleDrive.saveContacts(merged);

      // Update last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('lastDriveSync', now.toString());

      return merged.length;
    } catch (err: any) {
      setError(err.message || 'Failed to sync contacts');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const connect = useCallback(async () => {
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
  }, [syncContacts]);

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
