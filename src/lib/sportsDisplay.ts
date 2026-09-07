/**
 * Presentation helpers for the Sports experience.
 *
 * Honesty rules:
 * - Category imagery is illustrative and is always labelled as such. It never
 *   pretends to document a real match, athlete, venue or sponsor.
 * - A real, verified poster from the source always wins over the illustration.
 * - Nothing here invents a price, an hour or a location.
 */
import baloncestoImg from '@/assets/sports/baloncesto.jpg';
import futbolImg from '@/assets/sports/futbol.jpg';
import atletismoImg from '@/assets/sports/atletismo.jpg';
import ciclismoImg from '@/assets/sports/ciclismo.jpg';
import motorImg from '@/assets/sports/motor.jpg';
import acuaticosImg from '@/assets/sports/acuaticos.jpg';
import raquetaImg from '@/assets/sports/raqueta.jpg';
import otrosImg from '@/assets/sports/otros.jpg';
import { sanitizeEventImageUrl } from '@/lib/eventImageSource';

/** The limited, reusable illustration set. One image per discipline family. */
export const SPORT_IMAGES = {
  baloncesto: baloncestoImg,
  futbol: futbolImg,
  atletismo: atletismoImg,
  ciclismo: ciclismoImg,
  motor: motorImg,
  acuaticos: acuaticosImg,
  raqueta: raquetaImg,
  otros: otrosImg,
} as const;

export type SportImageKey = keyof typeof SPORT_IMAGES;

const FAMILY_BY_CATEGORY: Record<string, SportImageKey> = {
  baloncesto: 'baloncesto',
  basket: 'baloncesto',
  futbol: 'futbol',
  football: 'futbol',
  futsal: 'futbol',
  balonmano: 'otros',
  voleibol: 'otros',
  rugby: 'otros',
  atletismo: 'atletismo',
  running: 'atletismo',
  trail: 'atletismo',
  maraton: 'atletismo',
  triatlon: 'atletismo',
  ciclismo: 'ciclismo',
  btt: 'ciclismo',
  motor: 'motor',
  motociclismo: 'motor',
  automovilismo: 'motor',
  natacion: 'acuaticos',
  acuaticos: 'acuaticos',
  vela: 'acuaticos',
  piraguismo: 'acuaticos',
  surf: 'acuaticos',
  waterpolo: 'acuaticos',
  tenis: 'raqueta',
  padel: 'raqueta',
  badminton: 'raqueta',
  squash: 'raqueta',
  tenis_mesa: 'raqueta',
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_');

/** The illustration family for a stored `sport_category`. */
export function sportImageKey(sport?: string | null): SportImageKey {
  if (!sport) return 'otros';
  return FAMILY_BY_CATEGORY[normalize(sport)] ?? 'otros';
}

export function sportImage(sport?: string | null): string {
  return SPORT_IMAGES[sportImageKey(sport)];
}

export interface SportCardImage {
  src: string;
  /** True when the picture is the illustration, not the event's own poster. */
  illustrative: boolean;
}

/**
 * The picture for a sports card: the source's verified poster when there is a
 * usable one, otherwise the discipline illustration flagged as such.
 */
export function resolveSportImage(
  imageUrl: string | null | undefined,
  sport: string | null | undefined,
): SportCardImage {
  const real = sanitizeEventImageUrl(imageUrl);
  if (real) return { src: real, illustrative: false };
  return { src: sportImage(sport), illustrative: true };
}

export type SportItemKind = 'match' | 'tournament' | 'activity';

const TOURNAMENT_RE = /\b(liga|torneo|campeonato|supercopa|copa|circuito|open|trofeo|championship|league|masters)\b/i;
const MATCH_RE = /(\s-\s|\svs\.?\s|\sv\s)/i;

/** What kind of thing this is, so matches, competitions and activities never blur. */
export function sportItemKind(input: {
  title?: string | null;
  teams?: string | null;
  competition?: string | null;
}): SportItemKind {
  const teams = (input.teams ?? '').trim();
  const title = (input.title ?? '').trim();
  if (teams && MATCH_RE.test(teams)) return 'match';
  if (MATCH_RE.test(title)) return 'match';
  if (TOURNAMENT_RE.test(`${title} ${input.competition ?? ''}`)) return 'tournament';
  return 'activity';
}

/**
 * Price line. Only "Gratis" when the source says so, only an amount when the
 * source published one; otherwise the absence is stated, never guessed.
 */
export type PriceState = 'free' | 'known' | 'unknown';

export function sportPriceState(priceInfo?: string | null): PriceState {
  const value = (priceInfo ?? '').trim();
  if (!value) return 'unknown';
  if (/\b(gratis|free|libre|gratuit\w*|sin coste|entrada libre|0\s*€)\b/i.test(value)) return 'free';
  return 'known';
}
