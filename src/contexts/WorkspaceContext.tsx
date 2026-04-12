import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage, StorageService } from '@/services/storage';
import { teamStorage, TeamStorageService } from '@/services/teamStorage';
import { Organization } from '@/types/organization';
import { getOrganization } from '@/services/organizationService';

export type WorkspaceMode = 'personal' | 'team';

interface WorkspaceContextType {
    mode: WorkspaceMode;
    organization: Organization | null;
    isAdmin: boolean;
    canSwitchWorkspace: boolean;
    storage: StorageService | TeamStorageService;
    switchTo(mode: WorkspaceMode): void;
    refreshOrganization(): Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspace = (): WorkspaceContextType => {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return ctx;
};

const STORAGE_KEY = 'workspace_mode';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [mode, setMode] = useState<WorkspaceMode>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === 'team' ? 'team' : 'personal';
    });

    const orgId = user?.organizationId || null;
    const isAdmin = user?.orgRole === 'admin';
    const canSwitchWorkspace = !!orgId;

    // Load organization metadata when user changes
    useEffect(() => {
        if (!orgId) {
            setOrganization(null);
            teamStorage.setOrganization(null);
            // Force back to personal if user has no org
            if (mode === 'team') {
                setMode('personal');
                localStorage.setItem(STORAGE_KEY, 'personal');
            }
            return;
        }

        getOrganization(orgId).then(org => {
            setOrganization(org);
            teamStorage.setOrganization(orgId);
        }).catch(err => {
            console.error('Failed to load organization:', err);
            setOrganization(null);
        });
    }, [orgId]);

    const switchTo = useCallback((newMode: WorkspaceMode) => {
        if (newMode === 'team' && !canSwitchWorkspace) return;
        setMode(newMode);
        localStorage.setItem(STORAGE_KEY, newMode);
    }, [canSwitchWorkspace]);

    const refreshOrganization = useCallback(async () => {
        if (!orgId) return;
        const org = await getOrganization(orgId);
        setOrganization(org);
    }, [orgId]);

    const activeStorage = useMemo<StorageService | TeamStorageService>(() => {
        if (mode === 'team' && canSwitchWorkspace) {
            return teamStorage;
        }
        return storage;
    }, [mode, canSwitchWorkspace]);

    return (
        <WorkspaceContext.Provider value={{
            mode: canSwitchWorkspace ? mode : 'personal',
            organization,
            isAdmin,
            canSwitchWorkspace,
            storage: activeStorage,
            switchTo,
            refreshOrganization,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
