import { describe, it, expect } from 'vitest';
import {
  hasVerifiableProvenance,
  toAgendaEntity,
  mergeAgenda,
  sortAgenda,
  type SportsEventRow,
} from './sportsAgendaMerge';
import type { SportsEntity } from '@/types/sportsEntities';

const baseRow: SportsEventRow = {
  id: 'a1',
  title: 'Unicaja - Real Madrid',
  sport_category: 'baloncesto',
  start_datetime: '2026-10-04T18:30:00Z',
  venue_name: 'Palacio de Deportes Martín Carpena',
  address: 'Calle Royal Tennis Club 13, Málaga',
  city: 'Málaga',
  source_url: 'https://example.org/partido',
  status: 'confirmed',
};

const curated = (over: Partial<SportsEntity>): SportsEntity =>
  ({
    id: 'c1',
    entity_type: 'match',
    name: 'Unicaja - Real Madrid',
    sport: 'baloncesto',
    discipline: null,
    city: 'Málaga',
    district: null,
    address: null,
    latitude: null,
    longitude: null,
    date_start: '2026-10-04',
    date_end: null,
    time_start: null,
    time_end: null,
    organizer: null,
    official_url: null,
    registration_url: null,
    contact: null,
    price: null,
    age_group: null,
    accessibility: null,
    source_name: null,
    source_url: null,
    source_last_checked: null,
    status: 'verified',
    notes: null,
    tags: null,
    created_at: '',
    updated_at: '',
    ...over,
  }) as SportsEntity;

describe('hasVerifiableProvenance', () => {
  it('accepts confirmed rows with a source', () => {
    expect(hasVerifiableProvenance(baseRow)).toBe(true);
  });

  it('rejects rows that are not confirmed', () => {
    expect(hasVerifiableProvenance({ ...baseRow, status: 'scheduled' })).toBe(false);
  });

  it('rejects rows without provenance', () => {
    expect(hasVerifiableProvenance({ ...baseRow, source_url: null, canonical_url: null })).toBe(false);
  });
});

describe('toAgendaEntity', () => {
  it('converts to Madrid local date and time', () => {
    const e = toAgendaEntity(baseRow)!;
    expect(e.date_start).toBe('2026-10-04');
    expect(e.time_start).toBe('20:30:00'); // CEST = UTC+2
    expect(e.status).toBe('verified');
    expect(e.id).toBe('se-a1');
  });

  it('labels city-only locality evidence as needs_review', () => {
    const e = toAgendaEntity({ ...baseRow, address: null, venue_name: 'Pabellón Ciudad Jardín' })!;
    expect(e.status).toBe('needs_review');
  });

  it('drops arts content and away fixtures', () => {
    expect(toAgendaEntity({ ...baseRow, title: 'Concierto homenaje', sport_category: 'other' })).toBeNull();
    expect(toAgendaEntity({ ...baseRow, title: 'Celta - Málaga CF' })).toBeNull();
  });

  it('returns null for unusable rows', () => {
    expect(toAgendaEntity({ ...baseRow, start_datetime: null })).toBeNull();
    expect(toAgendaEntity({ ...baseRow, status: 'scheduled' })).toBeNull();
  });
});

describe('mergeAgenda', () => {
  it('keeps the curated entry when both describe the same match', () => {
    const merged = mergeAgenda([curated({})], [toAgendaEntity(baseRow)!]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('c1');
  });

  it('adds synced entries that are not curated', () => {
    const merged = mergeAgenda([], [toAgendaEntity(baseRow)!]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('se-a1');
  });
});

describe('sortAgenda', () => {
  it('sorts ascending and descending', () => {
    const a = curated({ id: 'a', date_start: '2026-01-01' });
    const b = curated({ id: 'b', date_start: '2026-02-01' });
    expect(sortAgenda([b, a], true).map((e) => e.id)).toEqual(['a', 'b']);
    expect(sortAgenda([a, b], false).map((e) => e.id)).toEqual(['b', 'a']);
  });
});
