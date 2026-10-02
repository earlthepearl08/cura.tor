/**
 * Minimal UI locale scaffolding.
 * Full app translation is not complete — only OCR-related strings are covered
 * so language preference has a home for future UI packs.
 */

export type UiLocale = 'en' | 'fil';

const STORAGE_KEY = 'ui_locale';

const STRINGS: Record<UiLocale, Record<string, string>> = {
    en: {
        'settings.ocrLanguages': 'OCR Languages',
        'settings.ocrLanguagesHint': 'Used for card and log-sheet scans. Select languages you expect on badges and sign-in sheets (up to {max}).',
        'settings.ocrLanguagesActive': 'Active for scans',
        'settings.uiLanguage': 'App language (preview)',
        'settings.uiLanguageHint': 'UI translation is incomplete. OCR language above is what improves scan accuracy today.',
        'scan.ocrLangBadge': 'OCR: {langs}',
        'logScan.ocrLangBadge': 'OCR: {langs}',
    },
    fil: {
        'settings.ocrLanguages': 'Mga Wika sa OCR',
        'settings.ocrLanguagesHint': 'Ginagamit sa card at log-sheet scans. Piliin ang mga wikang inaasahan sa badges at sign-in sheets (hanggang {max}).',
        'settings.ocrLanguagesActive': 'Aktibo sa mga scan',
        'settings.uiLanguage': 'Wika ng app (preview)',
        'settings.uiLanguageHint': 'Hindi pa kumpleto ang pagsasalin ng UI. Ang OCR language sa itaas ang nagpapabuti ng accuracy ngayon.',
        'scan.ocrLangBadge': 'OCR: {langs}',
        'logScan.ocrLangBadge': 'OCR: {langs}',
    },
};

export const UI_LOCALE_OPTIONS: { id: UiLocale; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'fil', label: 'Filipino' },
];

export function getUiLocale(): UiLocale {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === 'fil' || raw === 'en') return raw;
    } catch { /* ignore */ }
    return 'en';
}

export function setUiLocale(locale: UiLocale): void {
    localStorage.setItem(STORAGE_KEY, locale);
}

/** Tiny translator for scaffolded keys. Falls back to English, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
    const locale = getUiLocale();
    let text = STRINGS[locale][key] ?? STRINGS.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }
    return text;
}
