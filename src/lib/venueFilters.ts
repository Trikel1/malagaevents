/**
 * Merge helpers for the venue selector.
 *
 * Combines real DB venues (from useVenues) with the static frontend catalog
 * (VENUES_CATALOG). Frontend-only: does not create or filter any events
 * unless a real DB match exists. Catalog-only entries are surfaced as
 * "sin agenda activa" so the user still sees the full picture of Málaga.
 */

import {
  VENUES_CATALOG,
  VENUE_KIND_LABELS,
  type CatalogVenue,
  type VenueKind,
  type VenueZone,
} from './venuesCatalog';
import type { Venue } from '@/types';

export type VenueCategory = 'all' | 'capital' | 'provincia' | 'teatros' | 'salas' | 'museos' | 'auditorios' | 'exteriores' | 'festivales';

export interface MergedVenue {
  /** Real DB id when available. Only DB-backed venues actually filter events. */
  id: string | null;
  /** Slug from catalog when available (stable frontend key). */
  slug: string;
  name: string;
  city: string;
  zone: VenueZone;
  kind: VenueKind;
  /** True when a matching real venue exists in DB (i.e. filter will produce results). */
  hasEvents: boolean;
  status?: CatalogVenue['status'];
  /** Aliases + synonyms for searching. */
  searchTokens: string[];
}

export const normalize = (s: string): string =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isMalagaCity = (c?: string | null) => !!c && /m[aá]laga/i.test(c);

/** Map catalog kind → high-level UI category chip. */
export function kindToCategory(kind: VenueKind): Exclude<VenueCategory, 'all' | 'capital' | 'provincia'> {
  switch (kind) {
    case 'teatro': return 'teatros';
    case 'sala': return 'salas';
    case 'museo': return 'museos';
    case 'auditorio': return 'auditorios';
    case 'exterior': return 'exteriores';
    case 'festival': return 'festivales';
    case 'ferial':
    case 'espacio':
    default:
      return 'salas';
  }
}

/**
 * Fuse DB venues + catalog into a single deduplicated list.
 * Dedup key: normalized(name)+normalized(city). When both sources match, the
 * DB entry is preferred (its id is what actually filters events).
 */
export function mergeVenues(dbVenues: Venue[]): MergedVenue[] {
  const map = new Map<string, MergedVenue>();

  // Seed with catalog first — every catalog entry has stable metadata.
  for (const c of VENUES_CATALOG) {
    const key = `${normalize(c.name)}|${normalize(c.city)}`;
    const tokens = new Set<string>([
      normalize(c.name),
      normalize(c.city),
      c.slug,
      ...(c.searchAliases ?? []).map(normalize),
    ]);
    map.set(key, {
      id: null,
      slug: c.slug,
      name: c.name,
      city: c.city,
      zone: c.zone,
      kind: c.kind,
      hasEvents: false,
      status: c.status,
      searchTokens: Array.from(tokens),
    });
  }

  // Overlay DB venues.
  for (const v of dbVenues) {
    if (!v?.name) continue;
    if (v.name.toLowerCase().includes('sin sala')) continue;
    const city = v.city ?? (isMalagaCity(v.city) ? 'Málaga' : 'Málaga');
    const key = `${normalize(v.name)}|${normalize(city)}`;

    const existing = map.get(key);
    if (existing) {
      existing.id = v.id;
      existing.hasEvents = true;
      existing.searchTokens.push(normalize(v.name), v.normalized_name || '');
    } else {
      // DB venue not in catalog → still show it. Infer zone by city.
      const zone: VenueZone = isMalagaCity(v.city) ? 'malaga-ciudad' : 'costa-occidental';
      map.set(key, {
        id: v.id,
        slug: v.normalized_name || normalize(v.name),
        name: v.name,
        city: v.city || 'Málaga',
        zone,
        kind: 'espacio',
        hasEvents: true,
        searchTokens: [normalize(v.name), normalize(v.city || ''), v.normalized_name || ''],
      });
    }
  }

  return Array.from(map.values());
}

export interface FilterOptions {
  category: VenueCategory;
  search: string;
  /** Sort venues from these cities first (e.g. currently selected locality). */
  priorityCities?: string[];
}

/** Filter + rank merged venues for the selector UI. */
export function filterMerged(all: MergedVenue[], opts: FilterOptions): MergedVenue[] {
  const q = normalize(opts.search || '');
  const priorityNorm = (opts.priorityCities ?? []).map(normalize).filter(Boolean);

  const filtered = all.filter((v) => {
    // Category filter
    if (opts.category === 'capital' && v.zone !== 'malaga-ciudad') return false;
    if (opts.category === 'provincia' && v.zone === 'malaga-ciudad') return false;
    if (
      opts.category !== 'all' &&
      opts.category !== 'capital' &&
      opts.category !== 'provincia' &&
      kindToCategory(v.kind) !== opts.category
    ) return false;

    // Search
    if (q && !v.searchTokens.some((tok) => tok.includes(q))) return false;

    return true;
  });

  filtered.sort((a, b) => {
    // Priority city first
    const ap = priorityNorm.some((p) => normalize(a.city).includes(p)) ? 0 : 1;
    const bp = priorityNorm.some((p) => normalize(b.city).includes(p)) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    // Then Málaga capital
    const acap = a.zone === 'malaga-ciudad' ? 0 : 1;
    const bcap = b.zone === 'malaga-ciudad' ? 0 : 1;
    if (acap !== bcap) return acap - bcap;
    // Then hasEvents (real DB venues first)
    if (a.hasEvents !== b.hasEvents) return a.hasEvents ? -1 : 1;
    // Alphabetical
    return a.name.localeCompare(b.name, 'es');
  });

  return filtered;
}

export interface VenueSection {
  key: string;
  label: string;
  items: MergedVenue[];
}

/** Group filtered list into visual sections. */
export function groupIntoSections(list: MergedVenue[], category: VenueCategory): VenueSection[] {
  if (category === 'capital') {
    // Group by kind within Málaga capital
    const byKind = new Map<VenueKind, MergedVenue[]>();
    for (const v of list) {
      const arr = byKind.get(v.kind) ?? [];
      arr.push(v);
      byKind.set(v.kind, arr);
    }
    const order: VenueKind[] = ['teatro', 'auditorio', 'sala', 'museo', 'espacio', 'ferial', 'exterior', 'festival'];
    return order
      .filter((k) => byKind.has(k))
      .map((k) => ({ key: k, label: VENUE_KIND_LABELS[k], items: byKind.get(k)! }));
  }

  if (category === 'provincia' || category === 'all') {
    // Group by city, capital first
    const byCity = new Map<string, MergedVenue[]>();
    for (const v of list) {
      const arr = byCity.get(v.city) ?? [];
      arr.push(v);
      byCity.set(v.city, arr);
    }
    const cities = Array.from(byCity.keys()).sort((a, b) => {
      const am = isMalagaCity(a) ? 0 : 1;
      const bm = isMalagaCity(b) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.localeCompare(b, 'es');
    });
    return cities.map((c) => ({ key: c, label: c, items: byCity.get(c)! }));
  }

  // Category by kind → group by city
  const byCity = new Map<string, MergedVenue[]>();
  for (const v of list) {
    const arr = byCity.get(v.city) ?? [];
    arr.push(v);
    byCity.set(v.city, arr);
  }
  const cities = Array.from(byCity.keys()).sort((a, b) => {
    const am = isMalagaCity(a) ? 0 : 1;
    const bm = isMalagaCity(b) ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.localeCompare(b, 'es');
  });
  return cities.map((c) => ({ key: c, label: c, items: byCity.get(c)! }));
}

export const VENUE_CATEGORIES: Array<{ id: VenueCategory; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'capital', label: 'Málaga capital' },
  { id: 'provincia', label: 'Provincia' },
  { id: 'teatros', label: 'Teatros' },
  { id: 'salas', label: 'Salas' },
  { id: 'auditorios', label: 'Auditorios' },
  { id: 'museos', label: 'Museos' },
  { id: 'exteriores', label: 'Exteriores' },
  { id: 'festivales', label: 'Festivales' },
];
