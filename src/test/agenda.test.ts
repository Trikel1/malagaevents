import { describe, it, expect } from 'vitest';
import { haversineKm, formatDistance } from '@/lib/distance';
import { filterMunicipalities } from '@/hooks/useMunicipalities';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(36.72, -4.42, 36.72, -4.42)).toBeCloseTo(0, 3);
  });
  it('Málaga → Marbella ~ 50 km', () => {
    const d = haversineKm(36.7213, -4.4214, 36.5108, -4.8856);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(60);
  });
  it('Málaga → Ronda > 60km', () => {
    const d = haversineKm(36.7213, -4.4214, 36.7419, -5.1663);
    expect(d).toBeGreaterThan(60);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometre distance in metres', () => {
    expect(formatDistance(0.45)).toBe('450 m');
  });
  it('formats km with Spanish comma decimal', () => {
    expect(formatDistance(12.34)).toBe('12,3 km');
  });
});

describe('filterMunicipalities (accent-insensitive)', () => {
  const municipalities = [
    { id: '1', ine_code: '29065', name: 'Málaga', slug: 'malaga', comarca: 'Málaga capital', latitude: 36.72, longitude: -4.42, active: true },
    { id: '2', ine_code: '29051', name: 'Estepona', slug: 'estepona', comarca: 'Costa del Sol Occidental', latitude: 36.42, longitude: -5.14, active: true },
    { id: '3', ine_code: '29094', name: 'Vélez-Málaga', slug: 'velez-malaga', comarca: 'Axarquía', latitude: 36.78, longitude: -4.10, active: true },
  ];
  const aliases = [
    { id: 'a1', municipality_id: '3', alias: 'Torre del Mar', alias_normalized: 'torre del mar', alias_type: 'nucleo' },
  ];

  it('matches by name ignoring accents', () => {
    const r = filterMunicipalities('malaga', municipalities as any, aliases as any);
    expect(r.map((m) => m.slug)).toContain('malaga');
  });
  it('matches by comarca', () => {
    const r = filterMunicipalities('axarquia', municipalities as any, aliases as any);
    expect(r.map((m) => m.slug)).toEqual(['velez-malaga']);
  });
  it('resolves aliases (Torre del Mar → Vélez-Málaga)', () => {
    const r = filterMunicipalities('torre del mar', municipalities as any, aliases as any);
    expect(r.map((m) => m.slug)).toEqual(['velez-malaga']);
  });
  it('empty query returns all', () => {
    const r = filterMunicipalities('', municipalities as any, aliases as any);
    expect(r).toHaveLength(3);
  });
});
