import { EventTemplate } from '@/types/eventTemplate';
import { auth } from '@/config/firebase';

const STORAGE_PREFIX = 'curator_event_templates_v1_';

function storageKey(uid: string): string {
    return `${STORAGE_PREFIX}${uid}`;
}

function requireUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    return uid;
}

function readAll(uid: string): EventTemplate[] {
    try {
        const raw = localStorage.getItem(storageKey(uid));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed as EventTemplate[];
    } catch {
        return [];
    }
}

function writeAll(uid: string, templates: EventTemplate[]): void {
    localStorage.setItem(storageKey(uid), JSON.stringify(templates));
}

/** List saved event templates for the signed-in user (persists across sessions). */
export async function listEventTemplates(): Promise<EventTemplate[]> {
    const uid = requireUid();
    return readAll(uid).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getEventTemplate(id: string): Promise<EventTemplate | null> {
    const uid = requireUid();
    return readAll(uid).find(t => t.id === id) ?? null;
}

/** Create or update a template. */
export async function saveEventTemplate(
    template: Omit<EventTemplate, 'createdAt' | 'updatedAt'> & {
        createdAt?: number;
        updatedAt?: number;
    },
): Promise<EventTemplate> {
    const uid = requireUid();
    const all = readAll(uid);
    const now = Date.now();
    const existingIdx = all.findIndex(t => t.id === template.id);
    const saved: EventTemplate = {
        id: template.id,
        name: template.name.trim() || 'Untitled event',
        mappings: template.mappings,
        createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : (template.createdAt ?? now),
        updatedAt: now,
    };
    if (existingIdx >= 0) {
        all[existingIdx] = saved;
    } else {
        all.push(saved);
    }
    writeAll(uid, all);
    return saved;
}

export async function deleteEventTemplate(id: string): Promise<void> {
    const uid = requireUid();
    writeAll(uid, readAll(uid).filter(t => t.id !== id));
}
