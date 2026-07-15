import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseOfficialGuardHtml,
  dedupeGuardRows,
  buildOfficialUrl,
  canonicalMunicipality,
} from '../../supabase/functions/scrape-pharmacies/parser';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = resolve(here, '../../supabase/functions/scrape-pharmacies/__fixtures__');
const load = (name: string) => readFileSync(resolve(fixtures, name), { encoding: 'latin1' });

describe('parseOfficialGuardHtml', () => {
  it('parses an Antequera single-row result', () => {
    const html = load('antequera-2026-07-15.html');
    const url = buildOfficialUrl('29000011', '2026-07-15');
    const { available, rows } = parseOfficialGuardHtml(html, {
      source_ref: url,
      duty_date: '2026-07-15',
      zone_label: 'Antequera',
    });
    expect(available).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];
    expect(r.municipality).toBe('Antequera');
    expect(r.address.toLowerCase()).toContain('campillo');
    expect(r.duty_hours).toMatch(/GUARDIAS/i);
    expect(r.source_ref).toBe(url);
    expect(r.duty_date).toBe('2026-07-15');
    expect(r.name.startsWith('Farmacia')).toBe(true);
  });

  it('parses Málaga capital with many rows and sector municipalities', () => {
    const html = load('malaga-capital-2026-07-15.html');
    const { available, rows } = parseOfficialGuardHtml(html, {
      source_ref: buildOfficialUrl('29000001', '2026-07-15'),
      duty_date: '2026-07-15',
      zone_label: 'Málaga capital',
    });
    expect(available).toBe(true);
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) {
      expect(r.municipality).toBe('Málaga');
      expect(r.address.length).toBeGreaterThan(3);
    }
    // At least one row should carry a schedule label (portal announces it).
    expect(rows.some((r) => r.duty_hours && /GUARDIAS/i.test(r.duty_hours))).toBe(true);
  });

  it('returns available=false when the portal answers "Datos no disponibles"', () => {
    const html = load('no-data.html');
    const { available, rows } = parseOfficialGuardHtml(html, {
      source_ref: 'x',
      duty_date: '2026-07-15',
      zone_label: 'Antequera',
    });
    expect(available).toBe(false);
    expect(rows).toEqual([]);
  });

  it('deduplicates identical rows across zones', () => {
    const base = {
      name: 'Farmacia · Foo',
      address: 'Calle Foo 1',
      municipality: 'Málaga',
      sector: 'SECTOR CENTRO',
      duty_hours: 'GUARDIAS TODO EL DÍA',
      source_ref: 'https://example',
      duty_date: '2026-07-15',
    };
    const out = dedupeGuardRows([base, { ...base, sector: 'SECTOR OTRO' }, { ...base, address: 'Calle Foo 1 ' }]);
    expect(out).toHaveLength(1);
  });

  it('canonicalMunicipality maps sectors/barriadas to Málaga', () => {
    expect(canonicalMunicipality('SECTOR CENTRO')).toBe('Málaga');
    expect(canonicalMunicipality('BARRIADA CHURRIANA')).toBe('Málaga');
    expect(canonicalMunicipality('ANTEQUERA')).toBe('Antequera');
    expect(canonicalMunicipality('Fuengirola - Mijas')).toBe('Fuengirola - Mijas');
  });

  it('buildOfficialUrl uses D/M/YYYY (not M/D/YYYY)', () => {
    expect(buildOfficialUrl('29000011', '2026-07-15')).toContain('date=15/7/2026');
    expect(buildOfficialUrl('29000001', '2026-01-05', 'vzona')).toContain('date=5/1/2026');
  });
});
