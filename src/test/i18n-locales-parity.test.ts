import { describe, it, expect } from 'vitest';
import es from '@/i18n/locales/es.json';
import en from '@/i18n/locales/en.json';
import de from '@/i18n/locales/de.json';
import fr from '@/i18n/locales/fr.json';
import itIT from '@/i18n/locales/it.json';
import pt from '@/i18n/locales/pt.json';
import ja from '@/i18n/locales/ja.json';
import zh from '@/i18n/locales/zh.json';
import ru from '@/i18n/locales/ru.json';
import ar from '@/i18n/locales/ar.json';

type Node = { [k: string]: unknown };

function flatten(obj: Node, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Node, key, out);
    else out[key] = v;
  }
  return out;
}

const canonical = flatten(es as Node);
const canonicalKeys = Object.keys(canonical).sort();
const interpRe = /{{\s*[^}]+\s*}}/g;
function interpolations(v: unknown): string[] {
  if (typeof v !== 'string') return [];
  return (v.match(interpRe) || []).map((s) => s.replace(/\s+/g, '')).sort();
}

const others: Record<string, Node> = { en, de, fr, it: itIT, pt, ja, zh, ru, ar };

describe('i18n locales parity', () => {
  for (const [lang, resource] of Object.entries(others)) {
    describe(lang, () => {
      const flat = flatten(resource as Node);
      const keys = Object.keys(flat).sort();

      it('has exactly the same keys as es.json', () => {
        expect(keys).toEqual(canonicalKeys);
      });

      it('has matching value types', () => {
        for (const k of canonicalKeys) {
          expect(typeof flat[k]).toBe(typeof canonical[k]);
        }
      });

      it('has no empty values', () => {
        for (const k of canonicalKeys) {
          const v = flat[k];
          expect(v).not.toBe('');
          expect(v).not.toBeNull();
          expect(v).not.toBeUndefined();
        }
      });

      it('preserves {{variable}} interpolations', () => {
        for (const k of canonicalKeys) {
          expect(interpolations(flat[k])).toEqual(interpolations(canonical[k]));
        }
      });
    });
  }
});
