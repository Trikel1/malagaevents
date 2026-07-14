import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import { I18nextProvider } from 'react-i18next';
import { normalizeLanguageCode, getResolvedLanguage } from '@/i18n/language';
import { getDateLocale } from '@/i18n/dateLocale';
import i18n from '@/i18n';
import LanguageSelector from '@/components/common/LanguageSelector';

const LANG_KEY = 'malaga-events-lang';

describe('normalizeLanguageCode', () => {
  const cases: Array<[string, string]> = [
    ['en-US', 'en'],
    ['en_GB', 'en'],
    ['en', 'en'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['zh-CN', 'zh'],
    ['zh-TW', 'zh'],
    ['ar-SA', 'ar'],
    ['ES', 'es'],
    ['xx-YY', 'es'],
    ['', 'es'],
  ];
  for (const [input, expected] of cases) {
    it(`resolves "${input}" → "${expected}"`, () => {
      expect(normalizeLanguageCode(input)).toBe(expected);
    });
  }
});

describe('getResolvedLanguage', () => {
  it('prefers resolvedLanguage', () => {
    expect(getResolvedLanguage({ resolvedLanguage: 'en-US', language: 'es' })).toBe('en');
  });
  it('falls back to language then defaults', () => {
    expect(getResolvedLanguage({ language: 'pt-BR' })).toBe('pt');
    expect(getResolvedLanguage({})).toBe('es');
  });
});

describe('getDateLocale', () => {
  const langs: Array<[string, string]> = [
    ['es', 'es'], ['en-US', 'en-US'], ['de', 'de'], ['fr', 'fr'],
    ['it', 'it'], ['pt-BR', 'pt'], ['ar-SA', 'ar-SA'], ['ja', 'ja'],
    ['zh-CN', 'zh-CN'], ['ru', 'ru'],
  ];
  for (const [input, expectedCode] of langs) {
    it(`returns date-fns locale for ${input}`, () => {
      const loc = getDateLocale(input);
      expect(loc).toBeTruthy();
      expect(loc.code).toBe(expectedCode);
    });
  }
});

describe('i18n integration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('es');
  });

  it('sets <html lang="ar" dir="rtl"> for Arabic', async () => {
    await act(async () => { await i18n.changeLanguage('ar'); });
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets <html lang="en" dir="ltr"> for English', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('normalizes regional codes on changeLanguage', async () => {
    await act(async () => { await i18n.changeLanguage('en-US'); });
    // The applyHtmlLangDir hook re-aligns to base code.
    await new Promise((r) => setTimeout(r, 20));
    expect(document.documentElement.lang).toBe('en');
    expect(getResolvedLanguage(i18n)).toBe('en');
  });

  it('persists base code in malaga-events-lang', async () => {
    await act(async () => { await i18n.changeLanguage('pt-BR'); });
    await new Promise((r) => setTimeout(r, 20));
    const stored = localStorage.getItem(LANG_KEY);
    expect(stored).toBe('pt');
  });

  it('selector reflects the resolved language for regional codes and updates on change', async () => {
    await act(async () => { await i18n.changeLanguage('en-US'); });
    await new Promise((r) => setTimeout(r, 20));
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <LanguageSelector />
      </I18nextProvider>
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toMatch(/EN|English/);

    await act(async () => { await i18n.changeLanguage('fr'); });
    await new Promise((r) => setTimeout(r, 20));
    rerender(
      <I18nextProvider i18n={i18n}>
        <LanguageSelector />
      </I18nextProvider>
    );
    expect(getResolvedLanguage(i18n)).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByRole('combobox').textContent).toMatch(/FR|Français/);
  });
});
