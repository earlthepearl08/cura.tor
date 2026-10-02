/**
 * i18n foundations — OCR language control is the primary shippable surface.
 * UI locale scaffolding exists for a few OCR-related strings only.
 */
export {
    OCR_LANGUAGE_OPTIONS,
    MAX_OCR_LANGUAGES,
    getSelectedOcrLanguageIds,
    setSelectedOcrLanguageIds,
    toggleOcrLanguage,
    getSelectedOcrLanguageOptions,
    getTesseractLangString,
    getVisionLanguageHints,
    formatOcrLanguageSummary,
    buildGeminiLanguagePromptSection,
    getOcrLanguageOption,
    type OcrLanguageId,
    type OcrLanguageOption,
} from './ocrLanguages';

export {
    UI_LOCALE_OPTIONS,
    getUiLocale,
    setUiLocale,
    t,
    type UiLocale,
} from './uiLocale';
