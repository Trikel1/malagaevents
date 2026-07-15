import { describe, it, expect } from 'vitest';
import { isOfficialGuardSource } from './usePharmacies';

describe('isOfficialGuardSource — pharmacies_guard cannot surface fabricated rotations', () => {
  it('accepts the primary official source', () => {
    expect(isOfficialGuardSource('farmaciasguardia.farmaceuticos.com')).toBe(true);
    expect(isOfficialGuardSource('https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29')).toBe(true);
  });

  it('accepts the professional college sources', () => {
    expect(isOfficialGuardSource('icofma.es')).toBe(true);
    expect(isOfficialGuardSource('cofmalaga.com')).toBe(true);
    expect(isOfficialGuardSource('cgcof.es')).toBe(true);
    expect(isOfficialGuardSource('farmaceuticos.com')).toBe(true);
  });

  it('rejects fabricated / legacy tags', () => {
    expect(isOfficialGuardSource('fallback')).toBe(false);
    expect(isOfficialGuardSource('rotation')).toBe(false);
    expect(isOfficialGuardSource('fake')).toBe(false);
    expect(isOfficialGuardSource('estimated')).toBe(false);
    expect(isOfficialGuardSource('Directorio Local Málaga')).toBe(false);
    expect(isOfficialGuardSource('local')).toBe(false);
  });

  it('rejects empty / null / whitespace sources', () => {
    expect(isOfficialGuardSource(null)).toBe(false);
    expect(isOfficialGuardSource(undefined)).toBe(false);
    expect(isOfficialGuardSource('')).toBe(false);
  });

  it('rejects arbitrary third-party domains', () => {
    expect(isOfficialGuardSource('openstreetmap.org')).toBe(false);
    expect(isOfficialGuardSource('example.com')).toBe(false);
    expect(isOfficialGuardSource('some-random-scraper')).toBe(false);
  });
});
