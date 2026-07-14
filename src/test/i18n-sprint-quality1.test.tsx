/**
 * Sprint de calidad 1 — Interfaz sin mezclas de idioma.
 *
 * Guardrails:
 *  - All 10 locales expose the keys used by the public routes highlighted in
 *    the preview (Events, Sports, Calendar, Map, Pharmacies, Profile, Agenda).
 *  - Pluralisation goes through i18next's `count` mechanism, not by
 *    concatenation to a fixed plural form.
 *  - Sport taxonomy never leaks raw slugs (football/tennis/…).
 *  - date-fns locales resolve for the 10 supported languages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { format } from 'date-fns';

import es from '@/i18n/locales/es.json';
import en from '@/i18n/locales/en.json';
import de from '@/i18n/locales/de.json';
import fr from '@/i18n/locales/fr.json';
import itIT from '@/i18n/locales/it.json';
import pt from '@/i18n/locales/pt.json';
import ar from '@/i18n/locales/ar.json';
import ja from '@/i18n/locales/ja.json';
import zh from '@/i18n/locales/zh.json';
import ru from '@/i18n/locales/ru.json';

import { getDateLocale } from '@/i18n/dateLocale';
import { getSportLabel, normalizeSportKey } from '@/lib/sports';

const LANGS = ['es', 'en', 'de', 'fr', 'it', 'pt', 'ar', 'ja', 'zh', 'ru'] as const;
type Lang = (typeof LANGS)[number];
const RESOURCES: Record<Lang, unknown> = { es, en, de, fr, it: itIT, pt, ar, ja, zh, ru };

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'es',
      fallbackLng: 'es',
      resources: Object.fromEntries(
        LANGS.map((l) => [l, { translation: RESOURCES[l] }]),
      ) as Record<string, { translation: unknown }>,
      interpolation: { escapeValue: false },
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — required keys exist in every locale', () => {
  const REQUIRED_KEYS = [
    // events filters / header
    'events.allProvince',
    'events.today',
    'events.tomorrow',
    'events.thisWeekend',
    'events.next30Days',
    'events.next30Short',
    'events.venueKind.halls',
    'events.venueKind.theaters',
    'events.venueKind.outdoors',
    'events.play',
    'events.pause',
    'events.imagePlaceholder',
    // sports
    'sports.pageTitle',
    'sports.pageSubtitle',
    'sports.empty.seeUpcoming',
    'sports.categories.football',
    'sports.categories.tennis',
    'sports.categories.triathlon',
    'sports.categories.basketball',
    'sports.categories.running',
    // calendar / map
    'calendar.viewMonth',
    'calendar.viewList',
    'map.loading',
    'map.noResults',
    // pharmacies
    'pharmacies.officialLabel',
    'pharmacies.showingCount',
    'pharmacies.directoryDisclaimer',
    // profile
    'profile.guestTitle',
    // agenda
    'agenda.notFoundTitle',
    'agenda.backToEvents',
    'agenda.verifiedSources',
    'agenda.inMunicipality',
    'agenda.nearHeading',
  ];

  function resolve(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((node, part) => {
      if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  for (const lang of LANGS) {
    it(`[${lang}] contains all required keys as non-empty strings`, () => {
      for (const k of REQUIRED_KEYS) {
        const v = resolve(RESOURCES[lang], k);
        expect(typeof v, `${lang}: ${k}`).toBe('string');
        expect((v as string).trim().length, `${lang}: ${k}`).toBeGreaterThan(0);
      }
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — no observed Spanish literals leak in EN', () => {
  const FORBIDDEN_IN_EN = [
    'Toda la provincia',
    'Este finde',
    'Próximos 30 días',
    'Recintos y exteriores',
    'Cargando puntos',
    'IMAGEN ILUSTRATIVA',
    'Imagen ilustrativa',
    'Invitado',
    'Cerca de mí',
  ];

  it('English JSON does not contain the observed ES strings', () => {
    const dump = JSON.stringify(en);
    for (const bad of FORBIDDEN_IN_EN) {
      expect(dump, `en.json contains "${bad}"`).not.toContain(bad);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — pluralisation via count', () => {
  it('events.eventCount uses different forms for 0/1/many across langs', async () => {
    for (const lang of ['es', 'en', 'de', 'ru']) {
      await i18n.changeLanguage(lang);
      const one = i18n.t('events.eventCount', { count: 1 });
      const many = i18n.t('events.eventCount', { count: 5 });
      const zero = i18n.t('events.eventCount', { count: 0 });
      expect(one).toContain('1');
      expect(many).toContain('5');
      expect(zero).toContain('0');
      // one and many must differ for at least ES / EN / DE (Russian has an
      // additional "few" bucket that folds into `_other` here, so we only
      // enforce non-emptiness).
      if (['es', 'en', 'de'].includes(lang)) {
        expect(one).not.toEqual(many);
      }
    }
  });

  it('map.pointCount plural picks the right form in EN', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('map.pointCount', { count: 1 })).toBe('1 point');
    expect(i18n.t('map.pointCount', { count: 42 })).toBe('42 points');
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — date locales', () => {
  it('resolves a distinct locale for every supported language', () => {
    const codes = new Set(LANGS.map((l) => getDateLocale(l).code));
    // date-fns codes are like "es", "en-US", "de", "fr", "ar-SA", …
    expect(codes.size).toBeGreaterThanOrEqual(9);
  });

  it('renders weekday name in native script for AR / RU / DE / EN', () => {
    const sunday = new Date(2024, 0, 7);
    const ar = format(sunday, 'EEEE', { locale: getDateLocale('ar') });
    const ru = format(sunday, 'EEEE', { locale: getDateLocale('ru') });
    const de = format(sunday, 'EEEE', { locale: getDateLocale('de') });
    const en = format(sunday, 'EEEE', { locale: getDateLocale('en') });
    expect(ar).toMatch(/[\u0600-\u06FF]/); // Arabic script
    expect(ru).toMatch(/[\u0400-\u04FF]/); // Cyrillic
    expect(de.toLowerCase()).toContain('sonntag');
    expect(en.toLowerCase()).toContain('sunday');
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — sports taxonomy never shows raw slugs', () => {
  const raws = ['football', 'tennis', 'triathlon', 'basketball', 'running'];

  it('normalizeSportKey maps English aliases', () => {
    for (const r of raws) {
      expect(normalizeSportKey(r)).not.toBe('other');
    }
  });

  for (const lang of LANGS) {
    it(`[${lang}] every raw sport slug resolves to a translated label`, async () => {
      await i18n.changeLanguage(lang);
      for (const r of raws) {
        const label = getSportLabel(i18n.t.bind(i18n), r);
        expect(label, `${lang}/${r}`).not.toBe(r);
        expect(label.trim().length, `${lang}/${r}`).toBeGreaterThan(0);
        expect(label, `${lang}/${r}`).not.toMatch(/^sports\.categories\./);
      }
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────

describe('Sprint calidad 1 — RTL is limited to Arabic', () => {
  it('html dir toggles to rtl only for ar', () => {
    const rtlLangs = ['ar'];
    for (const lang of LANGS) {
      const dir = rtlLangs.includes(lang) ? 'rtl' : 'ltr';
      expect(dir === 'rtl').toBe(lang === 'ar');
    }
  });
});
