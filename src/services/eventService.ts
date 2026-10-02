import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { authFetch } from '@/utils/authFetch';
import { EventMember, EventWorkspace } from '@/types/eventWorkspace';

export type EventListItem = EventWorkspace & {
    isHost: boolean;
    writable: boolean;
    joinCode?: string;
};

function docToEvent(data: any, id: string): EventWorkspace {
    return {
        id,
        name: data.name || '',
        hostId: data.hostId || '',
        seatLimit: data.seatLimit ?? 5,
        joinCode: data.joinCode || '',
        claimsEnabled: data.claimsEnabled !== false,
        expiresAt: data.expiresAt?.toMillis?.() ?? data.expiresAt ?? 0,
        status: data.status === 'ended' ? 'ended' : 'active',
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0,
        updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
    };
}

export async function getEventWorkspace(eventId: string): Promise<EventWorkspace | null> {
    const snap = await getDoc(doc(db, 'eventWorkspaces', eventId));
    if (!snap.exists()) return null;
    return docToEvent(snap.data(), snap.id);
}

export async function getEventMembers(eventId: string): Promise<EventMember[]> {
    const snap = await getDocs(collection(db, 'eventWorkspaces', eventId, 'members'));
    return snap.docs.map((d): EventMember => {
        const data = d.data();
        return {
            uid: data.uid || d.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: data.role === 'host' ? 'host' as const : 'member' as const,
            joinedAt: data.joinedAt?.toMillis?.() ?? data.joinedAt ?? 0,
        };
    }).sort((a, b) => a.joinedAt - b.joinedAt);
}

export async function createEventWorkspace(params: {
    name: string;
    seatLimit?: number;
    durationDays?: number;
}): Promise<{ success: boolean; eventId?: string; joinCode?: string; expiresAt?: number; message: string }> {
    try {
        const res = await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', ...params }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Failed to create event' };
        return {
            success: true,
            eventId: data.eventId,
            joinCode: data.joinCode,
            expiresAt: data.expiresAt,
            message: 'Event created',
        };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to create event' };
    }
}

export async function joinEventWorkspace(code: string): Promise<{
    success: boolean;
    eventId?: string;
    name?: string;
    alreadyMember?: boolean;
    expiresAt?: number;
    message: string;
}> {
    try {
        const res = await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'join', code }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Failed to join event' };
        return {
            success: true,
            eventId: data.eventId,
            name: data.name,
            alreadyMember: data.alreadyMember,
            expiresAt: data.expiresAt,
            message: data.alreadyMember ? 'Already a member' : 'Joined event',
        };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to join event' };
    }
}

export async function leaveEventWorkspace(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'leave', eventId }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Failed to leave event' };
        return { success: true, message: 'Left event' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to leave event' };
    }
}

export async function endEventWorkspace(eventId: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end', eventId }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Failed to end event' };
        return { success: true, message: 'Event ended' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to end event' };
    }
}

export async function rotateEventJoinCode(eventId: string): Promise<{ success: boolean; joinCode?: string; message: string }> {
    try {
        const res = await authFetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rotate-code', eventId }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Failed to rotate code' };
        return { success: true, joinCode: data.joinCode, message: 'Join code updated' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to rotate code' };
    }
}

export type EventHostCapacity = {
    freeHostSlots: number;
    eventPackCredits: number;
    hostLimit: number;
    activeHosted: number;
};

export async function listEventWorkspaces(): Promise<{
    events: EventListItem[];
    capacity: EventHostCapacity | null;
}> {
    const res = await authFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to list events');
    return {
        events: (data.events || []) as EventListItem[],
        capacity: data.capacity || null,
    };
}

export function formatEventExpiry(expiresAt: number): string {
    if (!expiresAt) return '—';
    return new Date(expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function isEventActive(event: Pick<EventWorkspace, 'status' | 'expiresAt'>): boolean {
    return event.status === 'active' && event.expiresAt > Date.now();
}
