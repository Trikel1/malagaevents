import { es, enUS, de, fr, it, pt, ja, zhCN, ru, ar, type Locale } from 'date-fns/locale';

const locales: Record<string, Locale> = { es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru, ar };
export const dateLocale = (language: string): Locale => locales[language.split('-')[0]] ?? es;
export const longDatePattern = (language: string): string =>
  language.startsWith('es') ? "EEEE d 'de' MMMM" : 'EEEE d MMMM';
