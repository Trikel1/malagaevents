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

export type LanguageCode = typeof languages[number]['code'];

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

export const supportedLanguages: string[] = languages.map((l) => l.code);

/**
 * Regional codes (`en-US`, `es-ES`, `ar-EG`…) must resolve to the one locale we
 * actually ship, otherwise the selector and the content disagree: the badge
 * showed ES while every string rendered in English.
 */
export const normalizeLanguage = (lng: string | undefined | null): LanguageCode => {
  const base = (lng || '').split('-')[0].toLowerCase();
  return (supportedLanguages.includes(base) ? base : 'es') as LanguageCode;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: supportedLanguages,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'malaga-events-lang',
      convertDetectedLanguage: (lng: string) => normalizeLanguage(lng),
    },
  });

// Sync <html lang> and <html dir> with the active language for proper RTL support.
const applyHtmlLangDir = (lng: string) => {
  if (typeof document === 'undefined') return;
  const base = normalizeLanguage(lng);
  const meta = languages.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = meta?.dir === 'rtl' ? 'rtl' : 'ltr';
};

applyHtmlLangDir(i18n.language);
i18n.on('languageChanged', applyHtmlLangDir);

export default i18n;
