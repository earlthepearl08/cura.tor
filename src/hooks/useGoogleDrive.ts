import { useState, useEffect, useCallback } from 'react';
import { googleDrive } from '@/services/googleDrive';
import { storage } from '@/services/storage';

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

  const connect = useCallback(async () => {
    try {
      setError(null);
      await googleDrive.signIn();
      const state = googleDrive.getState();
      setIsConnected(state.isSignedIn);
      setUser(state.user);

      // Auto-sync after connecting
      await syncContacts();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Google Drive');
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    googleDrive.signOut();
    setIsConnected(false);
    setUser(null);
    setLastSyncTime(null);
    localStorage.removeItem('lastDriveSync');
  }, []);

  const syncContacts = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Not connected to Google Drive');
    }

    try {
      setIsSyncing(true);
      setError(null);

      // Get local contacts
      const localContacts = await storage.getAllContacts();

      // Save to Drive
      await googleDrive.saveContacts(localContacts);

      // Update last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('lastDriveSync', now.toString());
    } catch (err: any) {
      setError(err.message || 'Failed to sync contacts');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected]);

  const restoreFromDrive = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Not connected to Google Drive');
    }

    try {
      setIsSyncing(true);
      setError(null);

      // Load from Drive
      const driveContacts = await googleDrive.loadContacts();

      if (driveContacts.length === 0) {
        throw new Error('No backup found on Google Drive');
      }

      // Clear local storage and restore
      const allLocal = await storage.getAllContacts();
      for (const contact of allLocal) {
        await storage.deleteContact(contact.id);
      }

      for (const contact of driveContacts) {
        await storage.saveContact(contact);
      }

      // Update last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('lastDriveSync', now.toString());

      return driveContacts.length;
    } catch (err: any) {
      setError(err.message || 'Failed to restore from Drive');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected]);

  return {
    isConnected,
    user,
    isSyncing,
    lastSyncTime,
    error,
    connect,
    disconnect,
    syncContacts,
    restoreFromDrive,
  };
};
