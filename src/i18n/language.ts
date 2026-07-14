export const SUPPORTED_LANGUAGE_CODES = [
  'es',
  'en',
  'de',
  'fr',
  'it',
  'pt',
  'ar',
  'ja',
  'zh',
  'ru',
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'es';

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGE_CODES);

/**
 * Normalize any raw locale string (e.g. "en-US", "pt_BR", "ZH-Hant-TW", "ar-SA")
 * to one of the ten supported base language codes. Falls back to Spanish for
 * unknown languages.
 */
export function normalizeLanguageCode(language?: string | null): LanguageCode {
  if (!language) return DEFAULT_LANGUAGE;
  const base = language
    .toString()
    .toLowerCase()
    .replace(/_/g, '-')
    .split('-')[0]
    .trim();
  if (SUPPORTED_SET.has(base)) return base as LanguageCode;
  return DEFAULT_LANGUAGE;
}

interface MinimalI18n {
  resolvedLanguage?: string;
  language?: string;
  languages?: readonly string[];
}

/**
 * Return the currently active supported language code from an i18next
 * instance, preferring `resolvedLanguage` and falling back through the
 * detected language list.
 */
export function getResolvedLanguage(i18nInstance: MinimalI18n | null | undefined): LanguageCode {
  if (!i18nInstance) return DEFAULT_LANGUAGE;
  const candidates: (string | undefined)[] = [
    i18nInstance.resolvedLanguage,
    i18nInstance.language,
    ...(i18nInstance.languages ?? []),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const n = normalizeLanguageCode(c);
    // normalizeLanguageCode always returns a supported code (defaulting to `es`).
    // Only accept the first non-empty candidate; that's already normalized.
    return n;
  }
  return DEFAULT_LANGUAGE;
}
