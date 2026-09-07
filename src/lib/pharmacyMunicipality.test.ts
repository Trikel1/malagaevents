import { describe, it, expect } from 'vitest';
import {
  normalizeMunicipalityKey,
  resolveMunicipalitySlug,
  matchesMunicipality,
} from '@/lib/pharmacyMunicipality';

/**
 * Regression: the pharmacies "De guardia" tab returned zero results for every
 * municipality except Málaga capital, because the query compared the curated
 * catalog display name against the official portal's unaccented zone label
 * with an exact equality filter.
 *
 * These are the exact strings stored in pharmacies_guard for 2026-09-07.
 */
const REAL_GUARD_LABELS = [
  'Alhaurin De La Torre',
  'Alhaurin El Grande',
  'Alora',
  'Cartama',
  'Coin',
  'Velez-Malaga',
  'Rincon De La Victoria',
  'Casarabonela.',
  'Cuevas De San Marcos.',
  'Burgo (El)',
];

describe('pharmacy municipality matching', () => {
  it('fails with the old exact-equality comparison (documents the regression)', () => {
    // This is what the broken query did: .eq('municipality', 'Alhaurín de la Torre')
    const exactEq = (a: string, b: string) => a === b;
    expect(exactEq('Alhaurin De La Torre', 'Alhaurín de la Torre')).toBe(false);
    expect(exactEq('Velez-Malaga', 'Vélez-Málaga')).toBe(false);
  });

  it('matches the portal spelling against the catalog display name', () => {
    expect(matchesMunicipality('Alhaurin De La Torre', 'Alhaurín de la Torre')).toBe(true);
    expect(matchesMunicipality('Velez-Malaga', 'Vélez-Málaga')).toBe(true);
    expect(matchesMunicipality('Cartama', 'Cártama')).toBe(true);
    expect(matchesMunicipality('Coin', 'Coín')).toBe(true);
    expect(matchesMunicipality('Alora', 'Álora')).toBe(true);
    expect(matchesMunicipality('Rincon De La Victoria', 'Rincón de la Victoria')).toBe(true);
  });

  it('handles trailing dots and inverted articles from the source', () => {
    expect(normalizeMunicipalityKey('Casarabonela.')).toBe('casarabonela');
    expect(normalizeMunicipalityKey('Burgo (El)')).toBe('el burgo');
    expect(matchesMunicipality('Casarabonela.', 'Casarabonela')).toBe(true);
  });

  it('resolves every real guard label to a catalog municipality', () => {
    for (const label of REAL_GUARD_LABELS) {
      expect(resolveMunicipalitySlug(label), label).not.toBeNull();
    }
  });

  it('attributes known localities to their municipality', () => {
    expect(matchesMunicipality('Torre Del Mar', 'Vélez-Málaga')).toBe(true);
    expect(matchesMunicipality('La Cala De Moral', 'Rincón de la Victoria')).toBe(true);
    expect(matchesMunicipality('Arroyo De La Miel', 'Benalmádena')).toBe(true);
    expect(matchesMunicipality('Campanillas', 'Málaga')).toBe(true);
    // Source-side typo present in the real table.
    expect(matchesMunicipality('Fuengilora', 'Fuengirola')).toBe(true);
  });

  it('never attributes an ambiguous source label to a municipality', () => {
    expect(resolveMunicipalitySlug('Costa')).toBeNull();
    expect(resolveMunicipalitySlug('Estacion')).toBeNull();
    expect(matchesMunicipality('Costa', 'Marbella')).toBe(false);
    expect(matchesMunicipality('Costa', 'Málaga')).toBe(false);
  });

  it('does not confuse different municipalities', () => {
    expect(matchesMunicipality('Alhaurin El Grande', 'Alhaurín de la Torre')).toBe(false);
    expect(matchesMunicipality('Marbella', 'Málaga')).toBe(false);
    expect(matchesMunicipality('Fuengirola', 'Mijas')).toBe(false);
  });

  it('matches everything when no municipality is selected (province-wide)', () => {
    expect(matchesMunicipality('Costa', undefined)).toBe(true);
    expect(matchesMunicipality('Marbella', '')).toBe(true);
  });
});
