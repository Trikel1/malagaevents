import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { format } from 'date-fns';
import { getDateLocale } from '@/i18n/dateLocale';
import { SUPPORTED_LANGUAGE_CODES, normalizeLanguageCode, languages } from '@/i18n';

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'test' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('Sprint i18n 2 — hardcoded Spanish literals', () => {
  const files = walk(path.join(SRC, 'pages')).concat(walk(path.join(SRC, 'components')));

  it("no source file uses the Spanish date literal \"'de'\" in format tokens", () => {
    const bad: string[] = [];
    for (const f of files) {
      // Skip admin-only surfaces per sprint (public audit only).
      if (f.includes('/admin/') || f.includes('/AdminPage')) continue;
      const txt = readFileSync(f, 'utf8');
      // Match `format(..., "... 'de' ...")` style literals with the "'de'" preposition.
      if (/format\([^)]*"[^"]*'de'[^"]*"/.test(txt)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it("no public source imports the Spanish date-fns locale directly", () => {
    const bad: string[] = [];
    for (const f of files) {
      if (f.includes('/admin/') || f.includes('/AdminPage')) continue;
      const txt = readFileSync(f, 'utf8');
      if (/from ['"]date-fns\/locale['"]/.test(txt)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

describe('Sprint i18n 2 — getDateLocale produces localized names', () => {
  const d = new Date(2026, 6, 14); // Tuesday, July 14, 2026

  it('formats month names per language via PPPP', () => {
    const es = format(d, 'PPPP', { locale: getDateLocale('es') });
    const en = format(d, 'PPPP', { locale: getDateLocale('en') });
    const ar = format(d, 'PPPP', { locale: getDateLocale('ar') });
    expect(es.toLowerCase()).toContain('julio');
    expect(en.toLowerCase()).toContain('july');
    // Arabic month names should render in Arabic script (any Arabic letter).
    expect(/[\u0600-\u06FF]/.test(ar)).toBe(true);
    // No leftover "de" literal token from Spanish grammar leaks into non-es formatting.
    expect(en).not.toContain(" de ");
  });

  it('resolves to a valid locale for every supported language', () => {
    for (const code of SUPPORTED_LANGUAGE_CODES) {
      const loc = getDateLocale(code);
      expect(loc).toBeTruthy();
      expect(typeof format(d, 'PP', { locale: loc })).toBe('string');
    }
  });
});

describe('Sprint i18n 2 — RTL and language metadata', () => {
  it('marks only Arabic as RTL', () => {
    for (const lang of languages) {
      if (lang.code === 'ar') expect(lang.dir).toBe('rtl');
      else expect(lang.dir).toBe('ltr');
    }
  });

  it('normalizeLanguageCode collapses regional tags to base', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('zh-Hant-TW')).toBe('zh');
    expect(normalizeLanguageCode('pt_BR')).toBe('pt');
    expect(normalizeLanguageCode('unknown')).toBe('es');
  });
});

describe('Sprint i18n 2 — SEO keys exist in all locales', () => {
  const pages = [
    'events', 'calendar', 'map', 'venues', 'sports', 'profile',
    'submit', 'tickets', 'addTicket', 'pharmacies', 'auth', 'reset',
    'admin', 'notFound',
  ] as const;

  for (const code of SUPPORTED_LANGUAGE_CODES) {
    it(`${code}.json has a non-empty seo.<page>.title/description for every audited page`, () => {
      const json = JSON.parse(
        readFileSync(path.join(SRC, 'i18n/locales', `${code}.json`), 'utf8'),
      );
      for (const p of pages) {
        const node = json?.seo?.[p];
        expect(node, `${code}: missing seo.${p}`).toBeTruthy();
        expect(typeof node.title).toBe('string');
        expect(node.title.length).toBeGreaterThan(0);
        expect(typeof node.description).toBe('string');
        expect(node.description.length).toBeGreaterThan(0);
      }
    });
  }
});
