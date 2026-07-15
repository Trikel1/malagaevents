import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['es', 'en', 'de', 'fr', 'it', 'pt', 'ar', 'ja', 'zh', 'ru'] as const;

/**
 * The product is called exclusively "Málaga Events" in the UI. Older keys used
 * "Málaga Connect" or the compact "MalagaEvents" wordmark; both are regressions
 * we must never reintroduce in visible strings.
 */
describe('Brand naming — Málaga Events only', () => {
  const forbidden = ['Málaga Connect', 'Malaga Connect', 'MalagaEvents'];

  for (const lang of LOCALES) {
    it(`locale "${lang}" contains no legacy brand names`, () => {
      const raw = fs.readFileSync(
        path.resolve('src/i18n/locales', `${lang}.json`),
        'utf8',
      );
      for (const bad of forbidden) {
        expect(raw.includes(bad), `${lang}.json must not contain "${bad}"`).toBe(false);
      }
      expect(raw.includes('Málaga Events')).toBe(true);
    });
  }

  it('static head metadata uses Málaga Events', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    for (const bad of ['Málaga Connect', 'MalagaEvents']) {
      expect(html.includes(bad)).toBe(false);
    }
    expect(html.includes('Málaga Events')).toBe(true);
  });

  it('web manifest uses Málaga Events', () => {
    const raw = fs.readFileSync(path.resolve('public/manifest.webmanifest'), 'utf8');
    expect(raw.includes('MalagaEvents')).toBe(false);
    expect(raw.includes('Málaga Events')).toBe(true);
  });
});
