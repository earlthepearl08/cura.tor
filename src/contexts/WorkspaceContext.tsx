import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage, StorageService } from '@/services/storage';
import { teamStorage, TeamStorageService } from '@/services/teamStorage';
import { Organization } from '@/types/organization';
import { EventWorkspace } from '@/types/eventWorkspace';
import { getOrganization, subscribeOrganization } from '@/services/organizationService';
import { getEventWorkspace, listEventWorkspaces, EventListItem } from '@/services/eventService';

export type WorkspaceMode = 'personal' | 'team' | 'event';

interface WorkspaceSelection {
    mode: WorkspaceMode;
    eventId?: string;
}

interface WorkspaceContextType {
    mode: WorkspaceMode;
    organization: Organization | null;
    event: EventWorkspace | null;
    events: EventListItem[];
    isAdmin: boolean;
    /** True when viewing enterprise team or event shared space (claims/attribution apply). */
    isSharedMode: boolean;
    canSwitchWorkspace: boolean;
    storage: StorageService | TeamStorageService;
    switchTo(mode: WorkspaceMode, eventId?: string): void;
    refreshOrganization(): Promise<void>;
    refreshEvents(): Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspace = (): WorkspaceContextType => {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return ctx;
};

const STORAGE_KEY = 'workspace_selection_v2';
const LEGACY_KEY = 'workspace_mode';

function readSelection(): WorkspaceSelection {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as WorkspaceSelection;
            if (parsed.mode === 'personal' || parsed.mode === 'team' || parsed.mode === 'event') {
                return parsed;
            }
        }
    } catch {
        // fall through
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'team') return { mode: 'team' };
    return { mode: 'personal' };
}

function writeSelection(selection: WorkspaceSelection) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    localStorage.setItem(LEGACY_KEY, selection.mode === 'team' ? 'team' : 'personal');
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, refreshUserProfile } = useAuth();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [event, setEvent] = useState<EventWorkspace | null>(null);
    const [events, setEvents] = useState<EventListItem[]>([]);
    const [selection, setSelection] = useState<WorkspaceSelection>(() => readSelection());

    const orgId = user?.organizationId || null;
    const eventIds = user?.eventIds || [];
    const hasOrg = !!orgId;
    const hasEvents = eventIds.length > 0 || events.length > 0;
    const canSwitchWorkspace = hasOrg || hasEvents;

    const refreshEvents = useCallback(async () => {
        if (!user) {
            setEvents([]);
            return;
        }
        try {
            await refreshUserProfile();
            const { events: list } = await listEventWorkspaces();
            setEvents(list);
        } catch (err) {
            console.error('Failed to list events:', err);
        }
    }, [user, refreshUserProfile]);

    // Live organization metadata (claimsEnabled, seatLimit, name, …)
    useEffect(() => {
        if (!orgId) {
            setOrganization(null);
            if (selection.mode === 'team') {
                const next: WorkspaceSelection = { mode: 'personal' };
                setSelection(next);
                writeSelection(next);
            }
            return;
        }

        const unsub = subscribeOrganization(
            orgId,
            (org) => setOrganization(org),
            (err) => {
                console.error('Failed to sync organization:', err);
                setOrganization(null);
            },
        );
        return () => unsub();
    }, [orgId, selection.mode]);

    useEffect(() => {
        if (!user) {
            setEvents([]);
            setEvent(null);
            return;
        }
        listEventWorkspaces()
            .then(({ events: list }) => setEvents(list))
            .catch((err) => console.error('Failed to list events:', err));
    }, [user?.uid, eventIds.join('|')]);

    const effectiveMode: WorkspaceMode = useMemo(() => {
        if (selection.mode === 'team' && hasOrg) return 'team';
        if (selection.mode === 'event' && selection.eventId) {
            const stillMember = eventIds.includes(selection.eventId)
                || events.some((e) => e.id === selection.eventId);
            if (stillMember) return 'event';
        }
        return 'personal';
    }, [selection, hasOrg, eventIds, events]);

    useEffect(() => {
        if (effectiveMode === 'team' && orgId) {
            teamStorage.setOrganization(orgId);
            setEvent(null);
            return;
        }

        if (effectiveMode === 'event' && selection.eventId) {
            teamStorage.setEventWorkspace(selection.eventId);
            getEventWorkspace(selection.eventId)
                .then(setEvent)
                .catch((err) => {
                    console.error('Failed to load event:', err);
                    setEvent(null);
                });
            return;
        }

        teamStorage.setOrganization(null);
        setEvent(null);
    }, [effectiveMode, orgId, selection.eventId]);

    const switchTo = useCallback((mode: WorkspaceMode, eventId?: string) => {
        if (mode === 'team' && !hasOrg) return;
        if (mode === 'event' && !eventId) return;
        const next: WorkspaceSelection = mode === 'event'
            ? { mode: 'event', eventId }
            : { mode };
        setSelection(next);
        writeSelection(next);
    }, [hasOrg]);

    const refreshOrganization = useCallback(async () => {
        if (!orgId) return;
        const org = await getOrganization(orgId);
        setOrganization(org);
    }, [orgId]);

    const activeStorage = useMemo<StorageService | TeamStorageService>(() => {
        if (effectiveMode === 'team' || effectiveMode === 'event') {
            return teamStorage;
        }
        return storage;
    }, [effectiveMode]);

    const isSharedMode = effectiveMode === 'team' || effectiveMode === 'event';
    const isAdmin = effectiveMode === 'event'
        ? (!!event && event.hostId === user?.uid)
        : (effectiveMode === 'team' && user?.orgRole === 'admin');

    return (
        <WorkspaceContext.Provider value={{
            mode: effectiveMode,
            organization,
            event: effectiveMode === 'event' ? event : null,
            events,
            isAdmin: !!isAdmin,
            isSharedMode,
            canSwitchWorkspace,
            storage: activeStorage,
            switchTo,
            refreshOrganization,
            refreshEvents,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};
