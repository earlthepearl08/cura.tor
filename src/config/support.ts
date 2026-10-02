/**
 * Priority support contact path for Pro / Enterprise.
 * Email matches Legal.tsx; confirm with Earl before changing.
 */
export const SUPPORT_EMAIL = 'support@curator-app.com';

/** Soft SLA shown in-app — not a contractual guarantee until Earl formalizes it. */
export const PRIORITY_SUPPORT_SLA =
    'Pro & Enterprise: we aim to reply within 1 business day (PH time).';

export const STANDARD_SUPPORT_NOTE =
    'Free & Pioneer: email us anytime — Pro subscribers get priority in the queue.';

export type SupportCategory = 'ocr' | 'billing' | 'account' | 'feature' | 'other';

export const SUPPORT_CATEGORIES: { id: SupportCategory; label: string }[] = [
    { id: 'ocr', label: 'Scanning / OCR' },
    { id: 'billing', label: 'Billing / plan' },
    { id: 'account', label: 'Account / login' },
    { id: 'feature', label: 'Feature request' },
    { id: 'other', label: 'Other' },
];

export interface SupportMailPayload {
    category: SupportCategory;
    subject: string;
    message: string;
    userEmail?: string | null;
    userName?: string | null;
    tier?: string | null;
    priority?: boolean;
}

/** Build a mailto: URL with structured subject/body for inbox filters. */
export function buildSupportMailto(payload: SupportMailPayload): string {
    const tier = payload.tier || 'unknown';
    const priorityTag = payload.priority ? '[PRIORITY]' : '[SUPPORT]';
    const cat = payload.category.toUpperCase();
    const subjectBase = payload.subject.trim() || 'Cura.Tor help';
    const subject = `${priorityTag} [${cat}] ${subjectBase}`;

    const body = [
        payload.message.trim() || '(No message)',
        '',
        '---',
        'App context (please leave attached):',
        `Tier: ${tier}`,
        `Priority queue: ${payload.priority ? 'yes' : 'no'}`,
        `Account email: ${payload.userEmail || '(not signed in)'}`,
        `Name: ${payload.userName || '(n/a)'}`,
        `Page: ${typeof window !== 'undefined' ? window.location.href : ''}`,
        `User agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    ].join('\n');

    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
