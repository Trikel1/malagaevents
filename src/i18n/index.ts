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
  { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: 'AR', dir: 'rtl' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', dir: 'ltr' },
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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'malaga-events-lang',
    },
  });

// Sync <html lang> and <html dir> with the active language for proper RTL support.
const applyHtmlLangDir = (lng: string) => {
  if (typeof document === 'undefined') return;
  const base = (lng || 'es').split('-')[0];
  const meta = languages.find((l) => l.code === base);
  document.documentElement.lang = base;
  document.documentElement.dir = meta?.dir === 'rtl' ? 'rtl' : 'ltr';
};

applyHtmlLangDir(i18n.language);
i18n.on('languageChanged', applyHtmlLangDir);

export default i18n;
