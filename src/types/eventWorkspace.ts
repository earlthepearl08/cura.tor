export type EventMemberRole = 'host' | 'member';

export interface EventWorkspace {
    id: string;
    name: string;
    hostId: string;
    /** Max members including host (2–10). */
    seatLimit: number;
    /** Open join code (no email match). */
    joinCode: string;
    claimsEnabled: boolean;
    /** Epoch ms — after this, writes are blocked. */
    expiresAt: number;
    status: 'active' | 'ended';
    createdAt: number;
    updatedAt: number;
}

export interface EventMember {
    uid: string;
    email: string;
    displayName: string;
    role: EventMemberRole;
    joinedAt: number;
}

/** Default event duration when host doesn't pick one. */
export const DEFAULT_EVENT_DURATION_DAYS = 7;
/** Allowed seat range for event packs. */
export const EVENT_SEAT_MIN = 2;
export const EVENT_SEAT_MAX = 10;
export const EVENT_SEAT_DEFAULT = 5;
/** Soft cap: how many active events one user may host. */
export const MAX_ACTIVE_EVENTS_HOSTED = 3;
