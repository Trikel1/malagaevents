// Choice of the single event shown at the top of Home.
//
// The previous rule was "the first of the next 8 that happens to have an
// image", which promoted an online course with a stock poster over real,
// dated, located plans. This module ranks the candidates on what makes a plan
// actually useful to a reader — a real title, a real date, a real venue in the
// province — and never invents or hardcodes anything: if nothing scores well
// we still fall back to the soonest event, so Home is never empty on purpose.

import { hasExplicitTime } from './eventTime';

export interface FeaturedCandidate {
  id: string;
  title?: string | null;
  start_at: string;
  venue_name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  description?: string | null;
}

const PLACEHOLDER_VENUES = new Set([
  '',
  'n a',
  'na',
  'tbd',
  'unknown',
  'desconocido',
  'sin especificar',
  'por confirmar',
  'varios',
  'malaga',
  'provincia de malaga',
]);

const ONLINE_TERMS = [
  'online',
  'on line',
  'en linea',
  'streaming',
  'webinar',
  'virtual',
  'teleformacion',
  'a distancia',
  'zoom',
];

const plain = (value: string | null | undefined): string =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A venue string that names no real place. */
export const isVaguePlace = (venue: string | null | undefined): boolean =>
  PLACEHOLDER_VENUES.has(plain(venue));

/** Online-only plans are still listed in the agenda, just not featured. */
export const looksOnline = (event: FeaturedCandidate): boolean => {
  const haystack = `${plain(event.title)} ${plain(event.venue_name)} ${plain(event.address)}`;
  return ONLINE_TERMS.some((term) => haystack.includes(term));
};

export function scoreFeatured(event: FeaturedCandidate): number {
  let score = 0;
  if ((event.title ?? '').trim().length >= 6) score += 2;
  if (!isVaguePlace(event.venue_name)) score += 3;
  if ((event.address ?? '').trim()) score += 1;
  if (typeof event.lat === 'number' && typeof event.lng === 'number') score += 1;
  if (hasExplicitTime(event.start_at)) score += 2;
  if (event.image_url) score += 2;
  if (looksOnline(event)) score -= 5;
  return score;
}

/**
 * Pick the featured event: best score wins, ties go to the soonest start.
 * Returns null only when there is nothing upcoming at all.
 */
export function pickFeaturedEvent<T extends FeaturedCandidate>(events: T[]): T | null {
  const usable = events.filter((e) => !Number.isNaN(new Date(e.start_at).getTime()));
  if (usable.length === 0) return null;

  return usable.reduce((best, candidate) => {
    const bestScore = scoreFeatured(best);
    const score = scoreFeatured(candidate);
    if (score !== bestScore) return score > bestScore ? candidate : best;
    return new Date(candidate.start_at).getTime() < new Date(best.start_at).getTime()
      ? candidate
      : best;
  });
}
