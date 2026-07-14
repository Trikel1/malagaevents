import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';

import {
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode,
  type LanguageCode,
} from './language';

export { SUPPORTED_LANGUAGE_CODES, normalizeLanguageCode } from './language';
export type { LanguageCode } from './language';

const LANG_STORAGE_KEY = 'malaga-events-lang';

export const languages = [
  { code: 'es', shortCode: 'ES', nativeName: 'Español', name: 'Español', flag: 'ES', dir: 'ltr' },
  { code: 'en', shortCode: 'EN', nativeName: 'English', name: 'English', flag: 'EN', dir: 'ltr' },
  { code: 'de', shortCode: 'DE', nativeName: 'Deutsch', name: 'Deutsch', flag: 'DE', dir: 'ltr' },
  { code: 'fr', shortCode: 'FR', nativeName: 'Français', name: 'Français', flag: 'FR', dir: 'ltr' },
  { code: 'it', shortCode: 'IT', nativeName: 'Italiano', name: 'Italiano', flag: 'IT', dir: 'ltr' },
  { code: 'pt', shortCode: 'PT', nativeName: 'Português', name: 'Português', flag: 'PT', dir: 'ltr' },
  { code: 'ar', shortCode: 'AR', nativeName: 'العربية', name: 'العربية', flag: 'AR', dir: 'rtl' },
  { code: 'ja', shortCode: 'JA', nativeName: '日本語', name: '日本語', flag: 'JA', dir: 'ltr' },
  { code: 'zh', shortCode: 'ZH', nativeName: '中文', name: '中文', flag: 'ZH', dir: 'ltr' },
  { code: 'ru', shortCode: 'RU', nativeName: 'Русский', name: 'Русский', flag: 'RU', dir: 'ltr' },
] as const;

const resources = {
  es: { translation: es },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it },
  pt: { translation: pt },
  ja: { translation: ja },
  zh: { translation: zh },
  ru: { translation: ru },
  ar: { translation: ar },
};

// If a regional value ("en-US", "pt_BR", …) is already persisted, migrate it
// to the base code before i18next reads localStorage. This prevents the
// detector from writing a regional tag back and keeps a single canonical key.
if (typeof window !== 'undefined') {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) {
      const normalized = normalizeLanguageCode(stored);
      if (normalized !== stored) {
        window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
      }
    }
  } catch {
    /* ignore storage errors */
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGE_CODES as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    cleanCode: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_STORAGE_KEY,
    },
  });

// Sync <html lang> and <html dir> with the active language for proper RTL support.
let applying = false;
const applyHtmlLangDir = (lng: string) => {
  if (typeof document === 'undefined') return;
  const base: LanguageCode = normalizeLanguageCode(lng);
  const meta = languages.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = meta?.dir === 'rtl' ? 'rtl' : 'ltr';

  // If i18next resolved to a regional/unsupported tag, gently re-align it to
  // the base code so the selector, resources and persistence stay consistent.
  // Guard against re-entrancy.
  if (!applying && i18n.language && i18n.language !== base) {
    applying = true;
    void i18n.changeLanguage(base).finally(() => {
      applying = false;
    });
  }
};

applyHtmlLangDir(i18n.language);
i18n.on('languageChanged', applyHtmlLangDir);

export default i18n;
