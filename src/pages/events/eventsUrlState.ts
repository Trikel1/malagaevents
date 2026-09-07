/**
 * Single parse/serialize model for the culture Agenda (/events) URL.
 *
 * Rules:
 *  - The URL is the source of truth for *committed* (applied) filters.
 *  - Unknown / unrelated query params are always preserved.
 *  - Legacy links (`?filter=today|weekend|family|free|outdoor`, comma separated)
 *    keep working on read and are re-written to the canonical keys on the next
 *    serialization, without losing any of their scopes.
 *  - Every value is validated before it can reach a database query
 *    (presets, categories, age ranges, `yyyy-MM-dd` dates, UUID lists).
 */
import { EVENT_CATEGORIES, type EventCategory } from '@/types';
import type { AgeRange, DatePreset, EventFilters } from '@/components/events/FilterDrawer';

export const DATE_PRESETS = ['today', 'tomorrow', 'thisWeek', 'weekend', 'next30'] as const;
export const AGE_RANGES = ['0-3', '4-8', '9-12'] as const;

/** Every query param this page owns. Anything else is left untouched. */
export const OWNED_PARAMS = [
  'q',
  'category',
  'preset',
  'from',
  'to',
  'age',
  'free',
  'family',
  'outdoor',
  'tickets',
  'fav',
  'venues',
  'locations',
  'filter',
] as const;

export interface EventsUrlState {
  q: string;
  filters: EventFilters;
  venueIds: string[];
  locationIds: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidPreset = (v: string | null | undefined): v is DatePreset =>
  !!v && (DATE_PRESETS as readonly string[]).includes(v);

export const isValidAgeRange = (v: string | null | undefined): v is AgeRange =>
  !!v && (AGE_RANGES as readonly string[]).includes(v);

export const isValidCategory = (v: string): v is EventCategory =>
  (EVENT_CATEGORIES as readonly string[]).includes(v);

const splitList = (raw: string | null): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** `yyyy-MM-dd` -> local Date at midnight, or undefined when invalid. */
export const parseDayKey = (raw: string | null): Date | undefined => {
  if (!raw || !DAY_RE.test(raw)) return undefined;
  const [y, m, d] = raw.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  // Reject rolled-over dates such as 2026-02-31.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return date;
};

export const formatDayKey = (date: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

const parseUuidList = (raw: string | null): string[] =>
  Array.from(new Set(splitList(raw).filter((v) => UUID_RE.test(v))));

const isTruthyFlag = (raw: string | null): boolean =>
  raw === '1' || raw === 'true' || raw === 'yes';

export const parseEventsUrl = (sp: URLSearchParams): EventsUrlState => {
  const legacy = new Set(splitList(sp.get('filter')).map((v) => v.toLowerCase()));

  const categories = Array.from(new Set(splitList(sp.get('category')))).filter(isValidCategory);

  const rawPreset = sp.get('preset');
  const legacyPreset: DatePreset | undefined = legacy.has('today')
    ? 'today'
    : legacy.has('weekend')
      ? 'weekend'
      : legacy.has('tomorrow')
        ? 'tomorrow'
        : undefined;
  const datePreset = isValidPreset(rawPreset) ? rawPreset : legacyPreset;

  const dateFrom = datePreset ? undefined : parseDayKey(sp.get('from'));
  const dateTo = datePreset ? undefined : parseDayKey(sp.get('to'));

  const ageRaw = sp.get('age');
  const filters: EventFilters = {
    categories,
    datePreset,
    dateFrom,
    dateTo,
    isFree: isTruthyFlag(sp.get('free')) || legacy.has('free') ? true : undefined,
    familyKids: isTruthyFlag(sp.get('family')) || legacy.has('family') ? true : undefined,
    isOutdoor: isTruthyFlag(sp.get('outdoor')) || legacy.has('outdoor') ? true : undefined,
    withTickets: isTruthyFlag(sp.get('tickets')) ? true : undefined,
    onlyFavorites: isTruthyFlag(sp.get('fav')) ? true : undefined,
    ageRange: isValidAgeRange(ageRaw) ? ageRaw : undefined,
  };

  return {
    q: (sp.get('q') ?? '').trim(),
    filters,
    venueIds: parseUuidList(sp.get('venues')),
    locationIds: parseUuidList(sp.get('locations')),
  };
};

/**
 * Write the given state into `sp`, preserving every param this page does not own.
 * The legacy `filter` key is always dropped: its meaning is re-emitted through
 * the canonical keys, so shared legacy links never lose scope.
 */
export const serializeEventsUrl = (sp: URLSearchParams, state: EventsUrlState): URLSearchParams => {
  const next = new URLSearchParams(sp);
  OWNED_PARAMS.forEach((k) => next.delete(k));

  const { q, filters, venueIds, locationIds } = state;
  if (q) next.set('q', q);
  if (filters.categories.length > 0) next.set('category', filters.categories.join(','));
  if (filters.datePreset) next.set('preset', filters.datePreset);
  if (!filters.datePreset && filters.dateFrom) next.set('from', formatDayKey(filters.dateFrom));
  if (!filters.datePreset && filters.dateTo) next.set('to', formatDayKey(filters.dateTo));
  if (filters.ageRange) next.set('age', filters.ageRange);
  if (filters.isFree) next.set('free', '1');
  if (filters.familyKids) next.set('family', '1');
  if (filters.isOutdoor) next.set('outdoor', '1');
  if (filters.withTickets) next.set('tickets', '1');
  if (filters.onlyFavorites) next.set('fav', '1');
  if (venueIds.length > 0) next.set('venues', venueIds.join(','));
  if (locationIds.length > 0) next.set('locations', locationIds.join(','));

  return next;
};

/** Same query string (order-insensitive)? Used to avoid history spam / loops. */
export const isSameSearch = (a: URLSearchParams, b: URLSearchParams): boolean => {
  const norm = (sp: URLSearchParams) => {
    const entries = Array.from(sp.entries()).sort(([k1, v1], [k2, v2]) =>
      k1 === k2 ? v1.localeCompare(v2) : k1.localeCompare(k2),
    );
    return new URLSearchParams(entries).toString();
  };
  return norm(a) === norm(b);
};

/** Empty state: all owned params removed, unrelated params preserved. */
export const clearedEventsUrl = (sp: URLSearchParams): URLSearchParams =>
  serializeEventsUrl(sp, { q: '', filters: { categories: [] }, venueIds: [], locationIds: [] });
