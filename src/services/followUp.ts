import type { Contact, FollowUpStatus } from '@/types/contact';

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
    'claimed',
    'contacted',
    'meeting_set',
    'done',
];

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
    claimed: 'Claimed',
    contacted: 'Contacted',
    meeting_set: 'Meeting set',
    done: 'Done',
};

/** Default reminder: 2 days after claim / status change (no server jobs). */
export const DEFAULT_FOLLOW_UP_MS = 2 * 24 * 60 * 60 * 1000;

export const DUE_PRESETS: { label: string; offsetMs: number | null }[] = [
    { label: 'Today', offsetMs: 0 },
    { label: 'Tomorrow', offsetMs: 24 * 60 * 60 * 1000 },
    { label: 'In 3 days', offsetMs: 3 * 24 * 60 * 60 * 1000 },
    { label: 'In 1 week', offsetMs: 7 * 24 * 60 * 60 * 1000 },
    { label: 'Clear', offsetMs: null },
];

export function startOfLocalDay(ts = Date.now()): number {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function endOfLocalDay(ts = Date.now()): number {
    const d = new Date(ts);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

export function duePresetTimestamp(offsetMs: number | null): number | undefined {
    if (offsetMs === null) return undefined;
    return endOfLocalDay(Date.now() + offsetMs);
}

export function isFollowUpOverdue(contact: Contact, now = Date.now()): boolean {
    if (!contact.claimedBy) return false;
    if (contact.followUpStatus === 'done') return false;
    if (!contact.followUpDueAt) return false;
    return contact.followUpDueAt < startOfLocalDay(now);
}

export function isFollowUpDueToday(contact: Contact, now = Date.now()): boolean {
    if (!contact.claimedBy) return false;
    if (contact.followUpStatus === 'done') return false;
    if (!contact.followUpDueAt) return false;
    const due = contact.followUpDueAt;
    return due >= startOfLocalDay(now) && due <= endOfLocalDay(now);
}

export function effectiveFollowUpStatus(contact: Contact): FollowUpStatus | null {
    if (!contact.claimedBy) return null;
    return contact.followUpStatus || 'claimed';
}

export function summarizeMyFollowUps(contacts: Contact[], uid: string | undefined) {
    if (!uid) {
        return { overdue: [] as Contact[], dueToday: [] as Contact[], open: [] as Contact[] };
    }
    const mine = contacts.filter(
        (c) => c.claimedBy === uid && effectiveFollowUpStatus(c) !== 'done'
    );
    const overdue = mine.filter((c) => isFollowUpOverdue(c));
    const dueToday = mine.filter((c) => isFollowUpDueToday(c) && !isFollowUpOverdue(c));
    return { overdue, dueToday, open: mine };
}

export function formatDueLabel(dueAt?: number, now = Date.now()): string | null {
    if (!dueAt) return null;
    if (isFollowUpOverdue({ claimedBy: 'x', followUpDueAt: dueAt } as Contact, now)) {
        const days = Math.max(1, Math.ceil((startOfLocalDay(now) - startOfLocalDay(dueAt)) / (24 * 60 * 60 * 1000)));
        return days === 1 ? 'Overdue 1 day' : `Overdue ${days} days`;
    }
    if (isFollowUpDueToday({ claimedBy: 'x', followUpDueAt: dueAt } as Contact, now)) {
        return 'Due today';
    }
    return `Due ${new Date(dueAt).toLocaleDateString()}`;
}
