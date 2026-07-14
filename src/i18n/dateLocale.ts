import {
  es,
  enUS,
  de,
  fr,
  it,
  pt,
  ja,
  zhCN,
  ru,
  arSA,
  type Locale,
} from 'date-fns/locale';
import { normalizeLanguageCode, type LanguageCode } from './language';

const LOCALES: Record<LanguageCode, Locale> = {
  es,
  en: enUS,
  de,
  fr,
  it,
  pt,
  ar: arSA,
  ja,
  zh: zhCN,
  ru,
};

/**
 * Get the date-fns `Locale` object matching a language code. Accepts any raw
 * BCP-47 tag (e.g. "en-US", "pt-BR", "zh-CN") and resolves it to the base
 * language locale.
 */
export function getDateLocale(language?: string | null): Locale {
  const code = normalizeLanguageCode(language);
  return LOCALES[code];
}
