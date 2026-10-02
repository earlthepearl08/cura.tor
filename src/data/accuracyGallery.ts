/**
 * Public accuracy / sample gallery fixtures.
 * IDs align with eval/accuracy harness (PR #6) so real photos + expected.json
 * can be shared between marketing gallery and internal scoring later.
 *
 * Swap imagery: see /public/accuracy-samples/README.md
 */

export type GallerySampleType = 'card' | 'log-sheet';

export interface GalleryContactFields {
    name: string;
    company: string;
    position: string;
    phone: string[];
    email: string[];
    address: string;
    notes: string;
}

export interface GallerySample {
    id: string;
    type: GallerySampleType;
    title: string;
    subtitle: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    /** Public URL under /accuracy-samples/ */
    imageSrc: string;
    /** True until Earl drops a real photo in place */
    imageIsPlaceholder: boolean;
    highlights: string[];
    /** Single-card extraction, or first N log-sheet rows */
    extracted: GalleryContactFields | GalleryContactFields[];
}

export const ACCURACY_GALLERY_SAMPLES: GallerySample[] = [
    {
        id: 'card-001-stacked-logo',
        type: 'card',
        title: 'Stacked logo calling card',
        subtitle: 'PH trade-show style — brand mark above “Corporation”',
        difficulty: 'hard',
        tags: ['stacked-logo', 'multi-phone', 'multi-address', 'credentials', 'ph'],
        imageSrc: '/accuracy-samples/card-001-stacked-logo.svg',
        imageIsPlaceholder: true,
        highlights: [
            'Recombines KINMO PW + CORPORATION into one company name',
            'Splits phones separated by “/”',
            'Keeps Main Office + Branch addresses',
        ],
        extracted: {
            name: 'Engr. Maria Santos, REE, PEE',
            company: 'KINMO PW Corporation',
            position: 'Senior Sales Manager',
            phone: ['+63 917 555 1234', '8703-5284'],
            email: ['maria.santos@kinmopw.com'],
            address: 'Main Office: 12th Floor, BGC Tower, Taguig | Branch: Cebu Business Park',
            notes: 'www.kinmopw.com',
        },
    },
    {
        id: 'card-002-multi-phone',
        type: 'card',
        title: 'Multi-phone medical card',
        subtitle: 'Office, mobile, fax + two emails',
        difficulty: 'medium',
        tags: ['multi-phone', 'fax', 'multi-email', 'credentials', 'ph'],
        imageSrc: '/accuracy-samples/card-002-multi-phone.svg',
        imageIsPlaceholder: true,
        highlights: [
            'Separates fax with a (Fax) label',
            'Captures both emails',
            'Preserves MD credential on the name',
        ],
        extracted: {
            name: 'Dr. John Lee, MD',
            company: 'Health First Inc.',
            position: 'Medical Director',
            phone: ['+63 2 8888 9999', '0917-222-3333', '8362-5820 (Fax)'],
            email: ['jlee@healthfirst.ph', 'appointments@healthfirst.ph'],
            address: 'Quezon City, Metro Manila',
            notes: 'linkedin.com/in/johnlee-md',
        },
    },
    {
        id: 'sheet-001-ph-signin',
        type: 'log-sheet',
        title: 'Printed PH sign-in sheet',
        subtitle: 'Tabular trade-show log — three filled rows',
        difficulty: 'medium',
        tags: ['ph', 'tabular', 'trade-show', 'signin'],
        imageSrc: '/accuracy-samples/sheet-001-ph-signin.svg',
        imageIsPlaceholder: true,
        highlights: [
            'Each row → one contact',
            'Maps Name / Company / Phone / Email / Notes columns',
            'Handles company written with stacked brand on the sheet',
        ],
        extracted: [
            {
                name: 'Maria Santos',
                company: 'Acme Corp',
                position: 'Sales Manager',
                phone: ['+63 917 555 1234'],
                email: ['maria.santos@acme.com'],
                address: 'Makati City',
                notes: 'Booth interest',
            },
            {
                name: 'Dr. John Lee, MD',
                company: 'Health First Inc.',
                position: 'Medical Director',
                phone: ['+63 2 8888 9999', '0917-222-3333'],
                email: ['jlee@healthfirst.ph'],
                address: 'Quezon City',
                notes: '',
            },
            {
                name: 'Ana Reyes',
                company: 'KINMO PW Corporation',
                position: 'Procurement Lead',
                phone: ['0918-777-8888'],
                email: ['ana.reyes@kinmopw.com'],
                address: 'Taguig',
                notes: 'Follow up next week',
            },
        ],
    },
    {
        id: 'sheet-002-handwritten-mix',
        type: 'log-sheet',
        title: 'Handwritten mix sheet',
        subtitle: 'Partial fields — the hard case buyers ask about',
        difficulty: 'hard',
        tags: ['ph', 'handwriting', 'partial-fields', 'trade-show'],
        imageSrc: '/accuracy-samples/sheet-002-handwritten-mix.svg',
        imageIsPlaceholder: true,
        highlights: [
            'Best-effort on handwriting',
            'Leaves empty cells empty (no invented email)',
            'Still usable leads for follow-up',
        ],
        extracted: [
            {
                name: 'Carlo Mendoza',
                company: 'Bright Solar PH',
                position: 'Owner',
                phone: ['0917-111-2222'],
                email: [],
                address: 'Batangas',
                notes: 'wants quote',
            },
            {
                name: 'Liza Cruz',
                company: 'Metro Builders Co.',
                position: 'Architect',
                phone: ['02-8123-4567'],
                email: ['liza@metrobuilders.ph'],
                address: '',
                notes: '',
            },
        ],
    },
];
