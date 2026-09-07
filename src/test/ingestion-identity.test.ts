import { describe, it, expect } from 'vitest';
import { buildEventIdentity } from '../../supabase/functions/_shared/ingestion/identity.ts';

const base = {
  sourceSlug: 'agenda-municipal-malaga',
  sourceUrl: 'https://www.malaga.eu/la-ciudad/agenda/',
  title: '3D: Modelado 3D y Generación de Entornos para visitas en VR/AR',
  venueNormalized: 'online',
  locationNormalized: 'malaga',
  startAt: '2026-09-08T00:00:00.000Z',
  hasExplicitTime: false,
};

describe('buildEventIdentity', () => {
  it('reimporting the same event does not duplicate', () => {
    expect(buildEventIdentity(base).key).toBe(buildEventIdentity({ ...base }).key);
  });

  it('a later import that adds the published time recognises the day-only row', () => {
    const dayOnly = buildEventIdentity(base);
    const withTime = buildEventIdentity({
      ...base,
      startAt: '2026-09-08T18:00:00.000Z',
      hasExplicitTime: true,
    });
    expect(withTime.key).not.toBe(dayOnly.key);
    expect(withTime.lookupKeys).toContain(dayOnly.key);
  });

  it('completing venue or address does not duplicate when the source gives a URL', () => {
    const a = buildEventIdentity({ ...base, eventUrl: 'https://www.malaga.eu/agenda/curso-3d/' });
    const b = buildEventIdentity({
      ...base,
      eventUrl: 'https://www.malaga.eu/agenda/curso-3d?utm_source=news',
      venueNormalized: 'centro municipal',
    });
    expect(a.key).toBe(b.key);
  });

  it('keeps two legitimate sessions of the same day apart', () => {
    const morning = buildEventIdentity({ ...base, startAt: '2026-09-08T09:00:00.000Z', hasExplicitTime: true });
    const evening = buildEventIdentity({ ...base, startAt: '2026-09-08T18:00:00.000Z', hasExplicitTime: true });
    expect(morning.key).not.toBe(evening.key);
  });

  it('never merges two different events that share a title across sources', () => {
    const a = buildEventIdentity(base);
    const b = buildEventIdentity({ ...base, sourceSlug: 'otra-fuente' });
    expect(a.key).not.toBe(b.key);
  });

  it('prefers the source identifier over everything else', () => {
    const a = buildEventIdentity({ ...base, externalId: 'EVT-1234' });
    const b = buildEventIdentity({ ...base, externalId: 'EVT-1234', startAt: '2026-10-01T10:00:00.000Z', hasExplicitTime: true });
    expect(a.key).toBe(b.key);
  });

  it('does not treat the listing URL as a per-event identity', () => {
    const a = buildEventIdentity({ ...base, eventUrl: 'https://www.malaga.eu/la-ciudad/agenda/' });
    expect(a.key).toBe(buildEventIdentity(base).key);
  });
});
