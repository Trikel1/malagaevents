/**
 * Regional locales must resolve to the one language we actually ship, so the
 * selector badge and the rendered content can never disagree.
 */
import { describe, it, expect, afterAll } from 'vitest';
import i18n, { normalizeLanguage, languages } from '@/i18n';

describe('locale normalization', () => {
  afterAll(async () => {
    await i18n.changeLanguage('es');
  });

  it('maps regional codes to a shipped language', () => {
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('es-ES')).toBe('es');
    expect(normalizeLanguage('ar-EG')).toBe('ar');
    expect(normalizeLanguage('pt-BR')).toBe('pt');
  });

  it('falls back to Spanish for languages we do not ship', () => {
    expect(normalizeLanguage('nl-NL')).toBe('es');
    expect(normalizeLanguage(undefined)).toBe('es');
    expect(normalizeLanguage('')).toBe('es');
  });

  it('renders English content when the browser reports en-US, and the selector agrees', async () => {
    await i18n.changeLanguage('en-US');
    expect(normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)).toBe('en');
    expect(languages.find((l) => l.code === normalizeLanguage(i18n.language))?.shortCode).toBe('EN');
    expect(i18n.t('interests.title')).toBe(
      (await import('@/i18n/locales/en.json')).default.interests.title,
    );
  });

  it('sets document lang and dir for Arabic', async () => {
    await i18n.changeLanguage('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    await i18n.changeLanguage('es');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
