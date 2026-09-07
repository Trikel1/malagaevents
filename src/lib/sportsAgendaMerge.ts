/**
 * Sports agenda merge helpers.
 *
 * Audit 2026-09-07: the public sports agenda only read `sports_entities`, a
 * small hand-curated table, so the synced `sports_events` rows never reached
 * the user. This module normalizes those rows into the same shape the agenda
 * already renders, without inventing anything: a row is only surfaced when it
 * is `confirmed` AND carries verifiable provenance (a source URL), so every
 * card can still be traced back to its origin.
 */

import { formatInTimeZone } from 'date-fns-tz';
import type { SportsEntity } from '@/types/sportsEntities';
import { evaluateSportsEligibility } from './sportsEligibility';


export const MADRID_TZ = 'Europe/Madrid';

/** Minimal shape we rely on from `public.sports_events`. */
export interface SportsEventRow {
  id: string;
  title: string | null;
  sport_category?: string | null;
  sport_subcategory?: string | null;
  competition?: string | null;
  start_datetime: string | null;
  end_datetime?: string | null;
  venue_name?: string | null;
  city?: string | null;
  address?: string | null;
  price_info?: string | null;
  tickets_url?: string | null;
  registration_url?: string | null;
  organizer_name?: string | null;
  source_url?: string | null;
  canonical_url?: string | null;
  source_name?: string | null;
  last_seen_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** True when the row is safe to publish: confirmed and traceable. */
export function hasVerifiableProvenance(row: SportsEventRow): boolean {
  const provenance = row.source_url ?? row.canonical_url;
  return Boolean(row.status === 'confirmed' && provenance && row.title && row.start_datetime);
}

function madridParts(iso: string | null | undefined) {
  if (!iso) return { date: null as string | null, time: null as string | null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  return {
    date: formatInTimeZone(d, MADRID_TZ, 'yyyy-MM-dd'),
    time: formatInTimeZone(d, MADRID_TZ, 'HH:mm:ss'),
  };
}

/** Normalize one synced row into the agenda entity shape. */
export function toAgendaEntity(row: SportsEventRow): SportsEntity | null {
  if (!hasVerifiableProvenance(row)) return null;
  // Audit 2026-09-07: provenance alone let arts/religious content and away
  // fixtures reach the sports agenda. Apply the shared eligibility rules and
  // never label a locality as verified without venue/address evidence.
  const verdict = evaluateSportsEligibility(row);
  if (!verdict.eligible) return null;
  const start = madridParts(row.start_datetime);

  if (!start.date) return null;
  const end = madridParts(row.end_datetime);

  return {
    id: `se-${row.id}`,
    entity_type: 'match',
    name: row.title as string,
    sport: row.sport_category ?? null,
    discipline: row.sport_subcategory ?? row.competition ?? null,
    city: row.city ?? null,
    district: null,
    address: row.address ?? null,
    latitude: null,
    longitude: null,
    date_start: start.date,
    date_end: end.date,
    time_start: start.time,
    time_end: end.time,
    organizer: row.organizer_name ?? null,
    official_url: row.canonical_url ?? row.source_url ?? null,
    registration_url: row.registration_url ?? row.tickets_url ?? null,
    contact: null,
    price: row.price_info ?? null,
    age_group: null,
    accessibility: null,
    source_name: row.source_name ?? null,
    source_url: row.source_url ?? row.canonical_url ?? null,
    source_last_checked: row.last_seen_at ?? null,
    status: 'verified',
    notes: row.venue_name ?? null,
    tags: null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

/**
 * Merge curated entities with normalized synced rows.
 * Deduplicates on (normalized name + date_start) so a curated entry always
 * wins over its synced twin.
 */
export function mergeAgenda(curated: SportsEntity[], synced: SportsEntity[]): SportsEntity[] {
  const key = (e: SportsEntity) =>
    `${e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()}|${e.date_start ?? ''}`;
  const seen = new Set(curated.map(key));
  const out = [...curated];
  for (const e of synced) {
    if (seen.has(key(e))) continue;
    seen.add(key(e));
    out.push(e);
  }
  return out;
}

/** Sort by date, ascending or descending (for the "past" window). */
export function sortAgenda(entries: SportsEntity[], ascending: boolean): SportsEntity[] {
  return [...entries].sort((a, b) => {
    const cmp = (a.date_start ?? '').localeCompare(b.date_start ?? '');
    if (cmp !== 0) return ascending ? cmp : -cmp;
    return (a.time_start ?? '').localeCompare(b.time_start ?? '');
  });
}
