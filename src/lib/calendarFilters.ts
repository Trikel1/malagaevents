import { formatInTimeZone } from 'date-fns-tz';
import { CALENDAR_TIMEZONE } from './calendarEntries';
import type { CalendarEntry } from './calendarEntries';
import type { SportEvent } from '@/types/sports';
import { SPORT_LABELS, type SportCategory } from '@/types/sports';

export type CalendarMoment = 'any' | 'morning' | 'afternoon' | 'evening';

export interface CalendarFilters {
  moment: CalendarMoment;
  categories: string[];
  isFree: boolean;
  withTickets: boolean;
}

export const EMPTY_CALENDAR_FILTERS: CalendarFilters = {
  moment: 'any',
  categories: [],
  isFree: false,
  withTickets: false,
};

// ---------------- Cultural category groups ----------------

export type CulturalGroupId =
  | 'musica'
  | 'escena'
  | 'arte'
  | 'talleres'
  | 'fiestas'
  | 'familia'
  | 'otros';

export const CULTURAL_GROUP_LABELS: Record<CulturalGroupId, string> = {
  musica: 'Música',
  escena: 'Escena',
  arte: 'Arte y exposiciones',
  talleres: 'Talleres y charlas',
  fiestas: 'Fiestas y ferias',
  familia: 'En familia',
  otros: 'Otros planes',
};

// Order matters for display
export const CULTURAL_GROUP_ORDER: CulturalGroupId[] = [
  'musica',
  'escena',
  'arte',
  'talleres',
  'fiestas',
  'familia',
  'otros',
];

const GROUP_KEYWORDS: Array<{ id: CulturalGroupId; keywords: string[] }> = [
  { id: 'musica', keywords: ['music', 'música', 'musica', 'concierto', 'flamenco'] },
  { id: 'escena', keywords: ['theater', 'theatre', 'teatro', 'espectáculo', 'espectaculo', 'cine', 'ticketing', 'danza'] },
  { id: 'arte', keywords: ['exhibition', 'exposición', 'exposicion', 'museo', 'arte', 'galería', 'galeria'] },
  { id: 'talleres', keywords: ['workshop', 'taller', 'curso', 'conferencia', 'charla'] },
  { id: 'fiestas', keywords: ['festival', 'fiesta', 'feria', 'verbena'] },
  { id: 'familia', keywords: ['kids', 'infantil', 'familia', 'niño', 'nino', 'niños', 'ninos'] },
];

function normalizeText(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCulturalCategory(raw?: string | null): CulturalGroupId {
  if (!raw) return 'otros';
  const normalized = normalizeText(raw);
  for (const { id, keywords } of GROUP_KEYWORDS) {
    for (const kw of keywords) {
      if (normalized.includes(normalizeText(kw))) return id;
    }
  }
  return 'otros';
}

// ---------------- Moment (Europe/Madrid) ----------------

export function getMadridHour(iso: string | Date): number {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return Number(formatInTimeZone(date, CALENDAR_TIMEZONE, 'H'));
}

export function momentMatches(iso: string | Date, moment: CalendarMoment): boolean {
  if (moment === 'any') return true;
  const h = getMadridHour(iso);
  if (moment === 'morning') return h < 14;
  if (moment === 'afternoon') return h >= 14 && h < 20;
  return h >= 20;
}

// ---------------- Active group count ----------------

export function countActiveGroups(f: CalendarFilters): number {
  let n = 0;
  if (f.moment !== 'any') n += 1;
  if (f.categories.length > 0) n += 1;
  if (f.isFree) n += 1;
  if (f.withTickets) n += 1;
  return n;
}

// ---------------- Cultural: available groups in dataset ----------------

export function availableCulturalGroups(entries: CalendarEntry[]): CulturalGroupId[] {
  const present = new Set<CulturalGroupId>();
  for (const e of entries) {
    present.add(normalizeCulturalCategory(e.event?.category));
  }
  return CULTURAL_GROUP_ORDER.filter((g) => present.has(g));
}

// ---------------- Sports: available categories in dataset ----------------

export function availableSportCategories(events: SportEvent[]): SportCategory[] {
  const present = new Set<string>();
  for (const e of events) present.add(e.sport);
  return (Object.keys(SPORT_LABELS) as SportCategory[]).filter((s) => present.has(s));
}

// ---------------- Apply filters ----------------

export function applyCulturalFilters(
  entries: CalendarEntry[],
  filters: CalendarFilters,
): CalendarEntry[] {
  const cats = new Set(filters.categories);
  return entries.filter((entry) => {
    const ev = entry.event;
    if (!momentMatches(entry.start_datetime, filters.moment)) return false;
    if (cats.size > 0) {
      const group = normalizeCulturalCategory(ev?.category);
      if (!cats.has(group)) return false;
    }
    if (filters.isFree && ev?.is_free !== true) return false;
    if (filters.withTickets) {
      const hasTicket = Boolean(ev?.ticket_url || ev?.buy_url || entry.buy_url);
      if (!hasTicket) return false;
    }
    return true;
  });
}

export function applySportsFilters(
  events: SportEvent[],
  filters: CalendarFilters,
): SportEvent[] {
  const cats = new Set(filters.categories);
  return events.filter((ev) => {
    if (!momentMatches(ev.start_at, filters.moment)) return false;
    if (cats.size > 0 && !cats.has(ev.sport)) return false;
    return true;
  });
}
