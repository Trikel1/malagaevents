import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['es', 'en', 'de', 'fr', 'it', 'pt', 'ar', 'ja', 'zh', 'ru'] as const;
const FORBIDDEN = ['Málaga Connect', 'Malaga Connect', 'MalagaEvents'] as const;

/**
 * The product is called exclusively "Málaga Events" in the UI. Older names
 * ("Málaga Connect", "Malaga Connect" without accent, and the compact
 * "MalagaEvents" wordmark) are regressions we must never reintroduce in
 * visible strings, metadata or manifests.
 */
describe('Brand naming — Málaga Events only', () => {
  describe('locale JSON files', () => {
    for (const lang of LOCALES) {
      it(`locale "${lang}" contains no legacy brand names`, () => {
        const raw = fs.readFileSync(
          path.resolve('src/i18n/locales', `${lang}.json`),
          'utf8',
        );
        for (const bad of FORBIDDEN) {
          expect(raw.includes(bad), `${lang}.json must not contain "${bad}"`).toBe(false);
        }
        expect(raw.includes('Málaga Events')).toBe(true);
      });
    }
  });

  describe('static public assets', () => {
    const files = [
      'index.html',
      'public/offline.html',
      'public/llms.txt',
      'public/manifest.webmanifest',
    ];
    for (const file of files) {
      it(`${file} contains no legacy brand names`, () => {
        const raw = fs.readFileSync(path.resolve(file), 'utf8');
        for (const bad of FORBIDDEN) {
          expect(raw.includes(bad), `${file} must not contain "${bad}"`).toBe(false);
        }
        expect(raw.includes('Málaga Events')).toBe(true);
      });
    }
  });

  describe('index.html head metadata', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    const BRAND = 'Málaga Events';

    it('has <title> containing Málaga Events', () => {
      const m = html.match(/<title>([^<]*)<\/title>/);
      expect(m).not.toBeNull();
      expect(m![1]).toContain(BRAND);
    });

    it('meta application-name equals Málaga Events', () => {
      const m = html.match(/<meta\s+name="application-name"\s+content="([^"]+)"/);
      expect(m, 'meta application-name must exist').not.toBeNull();
      expect(m![1]).toBe(BRAND);
    });

    it('meta apple-mobile-web-app-title equals Málaga Events', () => {
      const m = html.match(/<meta\s+name="apple-mobile-web-app-title"\s+content="([^"]+)"/);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(BRAND);
    });

    it('og:site_name equals Málaga Events', () => {
      const m = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/);
      expect(m).not.toBeNull();
      expect(m![1]).toBe(BRAND);
    });

    it('JSON-LD blocks use Málaga Events for name (and alternateName if present)', () => {
      const scripts = [
        ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ];
      expect(scripts.length).toBeGreaterThan(0);
      let sawName = false;
      for (const [, body] of scripts) {
        const data = JSON.parse(body);
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          if (typeof node?.name === 'string') {
            sawName = true;
            for (const bad of FORBIDDEN) {
              expect(node.name.includes(bad)).toBe(false);
            }
          }
          if (typeof node?.alternateName === 'string') {
            for (const bad of FORBIDDEN) {
              expect(node.alternateName.includes(bad)).toBe(false);
            }
          }
        }
      }
      expect(sawName, 'at least one JSON-LD node must expose a name').toBe(true);
    });
  });

  describe('web manifest', () => {
    const raw = fs.readFileSync(path.resolve('public/manifest.webmanifest'), 'utf8');
    const manifest = JSON.parse(raw);

    it('name === "Málaga Events"', () => {
      expect(manifest.name).toBe('Málaga Events');
    });

    it('short_name === "Málaga Events"', () => {
      expect(manifest.short_name).toBe('Málaga Events');
    });
  });

  describe('source code (pages & components)', () => {
    function walk(dir: string, out: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
      }
      return out;
    }

    const files = [
      ...walk(path.resolve('src/pages')),
      ...walk(path.resolve('src/components')),
    ].filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));

    it('has no hardcoded legacy brand names in visible source', () => {
      const offenders: string[] = [];
      for (const file of files) {
        const raw = fs.readFileSync(file, 'utf8');
        // Strip line and block comments so commentary can't trip the guard.
        const stripped = raw
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        for (const bad of FORBIDDEN) {
          if (stripped.includes(bad)) offenders.push(`${file} → "${bad}"`);
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });
  });
});
