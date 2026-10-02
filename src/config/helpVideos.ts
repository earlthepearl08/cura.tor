/**
 * In-app help clip catalog (~60s each).
 *
 * Fill `youtubeUrl` and/or `mp4Src` when assets are ready.
 * Leave both empty to show the polished placeholder slot.
 *
 * See HELP_VIDEOS.md for drop-in instructions.
 */

export type HelpClipId = 'single-card' | 'multi-card' | 'log-sheet';

export interface HelpClip {
    id: HelpClipId;
    title: string;
    subtitle: string;
    durationLabel: string;
    description: string;
    tips: string[];
    /** In-app route to try the feature after watching */
    tryRoute: string;
    tryLabel: string;
    /**
     * YouTube watch or embed URL, e.g.
     * https://www.youtube.com/watch?v=XXXX or https://youtu.be/XXXX
     */
    youtubeUrl?: string;
    /**
     * Path to an MP4 under `public/`, e.g. `/help/single-card.mp4`
     */
    mp4Src?: string;
}

export const HELP_CLIPS: HelpClip[] = [
    {
        id: 'single-card',
        title: 'Single card scan',
        subtitle: 'Camera capture basics',
        durationLabel: '~60s',
        description:
            'Frame one business card, get a sharp shot, and review fields before saving.',
        tips: [
            'Hold the phone parallel to the card — avoid steep angles.',
            'Fill the viewfinder; keep logos and edges inside the frame.',
            'Watch for glare on glossy stock; tilt slightly if needed.',
            'Confirm name, company, phone, and email on the review screen.',
        ],
        tryRoute: '/scan',
        tryLabel: 'Open single scan',
        // youtubeUrl: 'https://www.youtube.com/watch?v=REPLACE_ME',
        // mp4Src: '/help/single-card.mp4',
    },
    {
        id: 'multi-card',
        title: 'Multi-card layout',
        subtitle: 'Several cards in one photo',
        durationLabel: '~60s',
        description:
            'Lay out multiple cards in one shot so Cura.Tor can split and parse each one.',
        tips: [
            'Spread cards flat with a little gap between them — no overlap.',
            'Shoot from directly above under even light.',
            'Keep the whole set in frame; avoid cutting edges.',
            'Review each extracted card before importing the batch.',
        ],
        tryRoute: '/multi-card',
        tryLabel: 'Open multi-card scan',
        // youtubeUrl: 'https://www.youtube.com/watch?v=REPLACE_ME',
        // mp4Src: '/help/multi-card.mp4',
    },
    {
        id: 'log-sheet',
        title: 'Log sheet scan',
        subtitle: 'Sign-in / lead sheets',
        durationLabel: '~60s',
        description:
            'Capture trade-show or booth log sheets — including multi-page and handwriting.',
        tips: [
            'Align the table so rows and columns are square in the frame.',
            'Avoid shadows and glare across the sheet.',
            'Use “add next sheet” for multi-page logs before importing.',
            'Spot-check uncertain handwritten rows after OCR.',
        ],
        tryRoute: '/log-scan',
        tryLabel: 'Open log sheet scan',
        // youtubeUrl: 'https://www.youtube.com/watch?v=REPLACE_ME',
        // mp4Src: '/help/log-sheet.mp4',
    },
];

export function getHelpClip(id: string | null | undefined): HelpClip | undefined {
    if (!id) return undefined;
    return HELP_CLIPS.find((c) => c.id === id);
}

/** Extract a YouTube video id from common URL shapes. */
export function youtubeIdFromUrl(url?: string): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) {
            return u.pathname.replace(/^\//, '').split('/')[0] || null;
        }
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/embed/')) {
                return u.pathname.split('/')[2] || null;
            }
            return u.searchParams.get('v');
        }
    } catch {
        return null;
    }
    return null;
}

export function clipHasMedia(clip: HelpClip): boolean {
    return !!(clip.mp4Src || youtubeIdFromUrl(clip.youtubeUrl));
}
