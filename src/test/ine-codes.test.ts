import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Fixture: Official INE 2026 municipality codes for province 29 (Málaga).
 * Source: https://www.ine.es/daco/daco42/codmun/26codmun.xlsx, sheet 29.
 *
 * This test guards against future regressions of the corrective migration
 * that fixed 24 mismatched codes. It parses the CSV fixture and asserts:
 *  - 103 rows, all unique
 *  - The 24 corrected slugs map to the exact official INE code
 *  - Critical segregated municipalities are canonical (29902/29903/29904)
 */

const CSV = readFileSync(
  resolve(__dirname, 'fixtures/ine_malaga_2026_oficial.csv'),
  'utf8',
);

interface Row { ine_code: string; name: string }

function parse(csv: string): Row[] {
  const lines = csv.trim().split(/\r?\n/);
  lines.shift(); // header
  return lines.map((l) => {
    const m = l.match(/^"?(\d{5})"?,"?\d"?,"(.+)"$/);
    if (!m) throw new Error(`Bad row: ${l}`);
    return { ine_code: m[1], name: m[2] };
  });
}

const rows = parse(CSV);
const byName = new Map(rows.map((r) => [r.name, r.ine_code]));

describe('INE 2026 official codes (Málaga)', () => {
  it('contains exactly 103 rows', () => {
    expect(rows).toHaveLength(103);
  });

  it('has 103 unique codes', () => {
    expect(new Set(rows.map((r) => r.ine_code)).size).toBe(103);
  });

  it('assigns the canonical codes to the three segregated municipalities', () => {
    expect(byName.get('Torremolinos')).toBe('29901');
    expect(byName.get('Villanueva de la Concepción')).toBe('29902');
    expect(byName.get('Montecorto')).toBe('29903');
    expect(byName.get('Serrato')).toBe('29904');
  });

  it('covers the 24 codes fixed by the corrective migration', () => {
    const expected: Record<string, string> = {
      Montecorto: '29903',
      Periana: '29079',
      Pizarra: '29080',
      Pujerra: '29081',
      'Rincón de la Victoria': '29082',
      Riogordo: '29083',
      Ronda: '29084',
      Salares: '29085',
      Sayalonga: '29086',
      Sedella: '29087',
      Serrato: '29904',
      'Sierra de Yeguas': '29088',
      Teba: '29089',
      Tolox: '29090',
      Torrox: '29091',
      Totalán: '29092',
      'Valle de Abdalajís': '29093',
      'Vélez-Málaga': '29094',
      'Villanueva de Algaidas': '29095',
      'Villanueva de Tapia': '29098',
      'Villanueva del Rosario': '29096',
      'Villanueva del Trabuco': '29097',
      Viñuela: '29099',
      Yunquera: '29100',
    };
    for (const [name, code] of Object.entries(expected)) {
      expect(byName.get(name), `INE code for ${name}`).toBe(code);
    }
  });
});
