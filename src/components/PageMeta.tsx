import { useEffect } from 'react';

const SITE_ORIGIN = 'https://cura-tor.vercel.app';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/icons/icon-512.png`;

type PageMetaProps = {
    title: string;
    description: string;
    path?: string;
    image?: string;
    type?: 'website' | 'article';
    noIndex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
    const selector = `meta[${attr}="${key}"]`;
    let el = document.head.querySelector<HTMLMetaElement>(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

/**
 * Client-side document head updates for public marketing routes.
 * Complements static tags in index.html (no react-helmet in this repo).
 */
export default function PageMeta({
    title,
    description,
    path = '/',
    image = DEFAULT_IMAGE,
    type = 'website',
    noIndex = false,
}: PageMetaProps) {
    useEffect(() => {
        const url = path.startsWith('http') ? path : `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
        const prevTitle = document.title;

        document.title = title;
        upsertMeta('name', 'description', description);
        upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

        upsertMeta('property', 'og:title', title);
        upsertMeta('property', 'og:description', description);
        upsertMeta('property', 'og:type', type);
        upsertMeta('property', 'og:url', url);
        upsertMeta('property', 'og:image', image);
        upsertMeta('property', 'og:site_name', 'Cura.tor');
        upsertMeta('property', 'og:locale', 'en_US');

        upsertMeta('name', 'twitter:card', 'summary_large_image');
        upsertMeta('name', 'twitter:title', title);
        upsertMeta('name', 'twitter:description', description);
        upsertMeta('name', 'twitter:image', image);

        upsertLink('canonical', url);

        return () => {
            document.title = prevTitle;
        };
    }, [title, description, path, image, type, noIndex]);

    return null;
}

export const LANDING_META = {
    title: 'Cura.tor — Log sheet & calling-card scanning',
    description:
        'Cura.tor reads trade-show log sheets and calling cards into structured contacts. Scan, review, export, and sync — with clear Free, Pioneer, Pro, and Enterprise plans.',
    path: '/',
} as const;

export const ACCURACY_GALLERY_META = {
    title: 'Accuracy samples — Cura.tor OCR gallery',
    description:
        'See how Cura.tor reads stacked-logo cards, multi-phone layouts, and handwritten Philippine trade-show sign-in sheets — before/after extraction samples.',
    path: '/accuracy',
} as const;
