/**
 * Conservative eligibility + provenance rules for public SPORTS surfaces.
 *
 * QA 2026-09-07 (read-only DB check) proved that `status = 'confirmed' AND
 * is_in_malaga_province = true` is NOT sufficient to publish a row as a
 * verified local sports plan. All future confirmed rows carried
 * `sport_category = 'other'` and the set included:
 *   - arts/religious content ("Espectáculo Ronda Flamenca", "Concierto
 *     Homenaje a Federico García Lorca", Holy Week style processions),
 *   - away fixtures pinned to Málaga by a city-only match
 *     ("Celta - Málaga CF" at Estadio ABANCA Balaídos, Getafe/Coliseum,
 *     Alavés/Mendizorroza).
 *
 * The rules below are deliberately positive-evidence based, so they do not
 * depend on a blocklist of away stadiums:
 *   1. Discipline must be established by explicit evidence (category,
 *      subcategory, competition or a word-boundary term in the title).
 *   2. Arts/religious content is never a sport unless an explicit sport term
 *      is present (a charity race is still a race).
 *   3. Locality must be proven by the VENUE or the ADDRESS naming a Málaga
 *      province municipality. `city` alone is never enough.
 *   4. A fixture where the local club is the visiting side is never local,
 *      whatever the `city` column says.
 * Anything unproven stays "unverified" and is omitted, with an honest
 * coverage note — never shown with a verified badge.
 */

import { LOCALITIES_CATALOG } from './localitiesCatalog';

export interface SportsRowLike {
  title?: string | null;
  sport_category?: string | null;
  sport_subcategory?: string | null;
  competition?: string | null;
  teams?: string | null;
  venue_name?: string | null;
  city?: string | null;
  address?: string | null;
  organizer_name?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  canonical_url?: string | null;
}

export type IneligibilityReason =
  | 'non_sport_content'
  | 'unknown_discipline'
  | 'locality_unverified'
  | 'away_fixture'
  | 'no_provenance';

/** Broad discipline plus the concrete kind of activity, when known. */
export type SportsKind = 'competition' | 'race' | 'meet' | 'outdoor' | 'unknown';

/**
 * Publication tier:
 *  - `verified`: venue or postal address names a Málaga province municipality.
 *  - `provisional`: only the `city` column supports the locality and the venue
 *    is a real (non-placeholder) name — publishable, but must be labelled
 *    "sede por confirmar" and never presented as verified.
 *  - `omitted`: not publishable on a sports surface.
 */
export type SportsTier = 'verified' | 'provisional' | 'omitted';

export interface SportsEligibility {
  eligible: boolean;
  tier: SportsTier;
  reason: IneligibilityReason | null;
  discipline: string | null;
  /** Human-facing detail, e.g. "concentración de scooters clásicas". */
  disciplineDetail: string | null;
  kind: SportsKind;
  disciplineEvidence: 'category' | 'subcategory' | 'competition' | 'title' | null;
  localityVerified: boolean;
  municipality: string | null;
  awayFixture: boolean;
}


export const normalize = (value: string | null | undefined): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Whole-word (multi-word) match, so "moto" never matches "motor". */
export const hasTerm = (haystack: string, term: string): boolean => {
  const t = normalize(term);
  if (!t) return false;
  return new RegExp(`(^| )${t.replace(/ /g, ' ')}( |$)`).test(haystack);
};

const hasAny = (haystack: string, terms: readonly string[]) =>
  terms.some((term) => hasTerm(haystack, term));

/** Explicit sport terms → canonical discipline. Order matters (first wins). */
const DISCIPLINE_TERMS: ReadonlyArray<{
  discipline: string;
  kind: SportsKind;
  detail?: string;
  terms: readonly string[];
}> = [
  { discipline: 'ciclismo', kind: 'competition', terms: ['trialbici', 'trial bici', 'ciclismo', 'btt', 'mtb', 'ciclista', 'vuelta ciclista', 'duatlon', 'gran fondo'] },
  { discipline: 'atletismo', kind: 'race', terms: ['carrera', 'carrera solidaria', 'media maraton', 'maraton', 'cross', '10k', '5k', 'atletismo', 'trail running'] },
  { discipline: 'baloncesto', kind: 'competition', terms: ['baloncesto', 'basket', 'acb', 'liga endesa', 'euroliga', 'eurocup', 'unicaja baloncesto'] },
  { discipline: 'futbol', kind: 'competition', terms: ['futbol', 'laliga', 'la liga', 'primera federacion', 'segunda division', 'copa del rey', 'futbol sala'] },
  { discipline: 'balonmano', kind: 'competition', terms: ['balonmano'] },
  { discipline: 'voleibol', kind: 'competition', terms: ['voleibol', 'volley', 'voley playa'] },
  { discipline: 'natacion', kind: 'competition', terms: ['natacion', 'travesia a nado', 'waterpolo'] },
  { discipline: 'triatlon', kind: 'competition', terms: ['triatlon', 'ironman'] },
  { discipline: 'padel', kind: 'competition', terms: ['padel'] },
  { discipline: 'tenis', kind: 'competition', terms: ['tenis'] },
  { discipline: 'golf', kind: 'competition', terms: ['golf'] },
  { discipline: 'vela', kind: 'competition', terms: ['vela', 'regata', 'piragüismo', 'piraguismo', 'remo'] },
  { discipline: 'montanismo', kind: 'outdoor', terms: ['senderismo', 'montanismo', 'montanera', 'escalada', 'espeleologia', 'barranquismo', 'marcha montanera'] },
  {
    discipline: 'motor',
    kind: 'meet',
    detail: 'concentración de vehículos clásicos (no es competición)',
    terms: ['concentracion de vespas', 'vespas y lambretas', 'reunion de vespas', 'concentracion motera', 'concentracion de clasicos'],
  },
  { discipline: 'motor', kind: 'competition', terms: ['motociclismo', 'motogp', 'superbike', 'automovilismo', 'rally', 'karting', 'motocross'] },
  { discipline: 'artes marciales', kind: 'competition', terms: ['judo', 'karate', 'taekwondo', 'boxeo', 'jiu jitsu', 'lucha'] },
  { discipline: 'hipica', kind: 'competition', terms: ['hipica', 'concurso de saltos', 'doma clasica'] },
  { discipline: 'ajedrez', kind: 'competition', terms: ['ajedrez'] },
];

/** Arts / religious / civic content that must never be published as SPORT. */
const NON_SPORT_TERMS: readonly string[] = [
  'concierto', 'conciertos', 'flamenca', 'flamenco', 'espectaculo', 'recital', 'homenaje',
  'teatro', 'zarzuela', 'opera', 'danza', 'exposicion', 'museo', 'poesia', 'monologo',
  'procesion', 'procesiones', 'cofradia', 'hermandad', 'via crucis', 'misa', 'romeria',
  'traslado', 'besamanos', 'verdiales', 'pregon', 'feria', 'certamen literario',
];

/** Generic categories that prove nothing on their own. */
const EMPTY_CATEGORIES = new Set(['', 'other', 'otro', 'otros', 'general', 'unknown', 'desconocido', 'varios']);

/** Local club tokens used only to detect the home/away side of a fixture. */
const LOCAL_CLUB_TERMS: readonly string[] = [
  'malaga cf', 'malaga club de futbol', 'unicaja baloncesto', 'unicaja',
  'rincon fertilidad', 'costa del sol malaga', 'marbella fc', 'club deportivo malaga',
];

/** Scraper placeholders that do not identify a real venue. */
const PLACEHOLDER_VENUES = new Set([
  '', 'n a', 'na', 'not specified', 'no specified venue', 'no data available',
  'unknown', 'desconocido', 'tbd', 'sin especificar', 'pabellon', 'polideportivo',
  'varios', 'por confirmar', 'costa del sol', 'null',
]);

export const isPlaceholderVenue = (venue: string | null | undefined): boolean =>
  PLACEHOLDER_VENUES.has(normalize(venue));

const MUNICIPALITIES: ReadonlyArray<{ name: string; needles: string[] }> = LOCALITIES_CATALOG.map((l) => ({

  name: l.name,
  needles: [normalize(l.name), normalize(l.slug), ...(l.aliases ?? []).map(normalize)].filter(Boolean),
}));

/** First Málaga province municipality named in the text, if any. */
export function findMalagaMunicipality(text: string | null | undefined): string | null {
  const hay = normalize(text);
  if (!hay) return null;
  for (const m of MUNICIPALITIES) {
    if (m.needles.some((needle) => hasTerm(hay, needle))) return m.name;
  }
  return null;
}

/**
 * Detect a fixture where the local club plays away.
 * Generic: splits "A - B" / "A vs B" and checks which side is local.
 * No stadium blocklist involved.
 */
export function isAwayFixture(row: SportsRowLike): boolean {
  const raw = `${row.teams ?? ''} ${row.title ?? ''}`;
  const sides = raw.split(/\s+(?:-|–|—|vs\.?|contra)\s+/i);
  if (sides.length < 2) return false;
  const home = normalize(sides[0]);
  const away = normalize(sides.slice(1).join(' '));
  const homeIsLocal = hasAny(home, LOCAL_CLUB_TERMS);
  const awayIsLocal = hasAny(away, LOCAL_CLUB_TERMS);
  return awayIsLocal && !homeIsLocal;
}

export function evaluateSportsEligibility(row: SportsRowLike): SportsEligibility {
  const title = normalize(row.title);
  const competition = normalize(`${row.competition ?? ''} ${row.sport_subcategory ?? ''}`);
  const category = normalize(row.sport_category);
  const searchable = `${title} ${competition} ${normalize(row.organizer_name)}`.trim();

  // --- 1. Discipline -------------------------------------------------------
  let discipline: string | null = null;
  let disciplineDetail: string | null = null;
  let kind: SportsKind = 'unknown';
  let disciplineEvidence: SportsEligibility['disciplineEvidence'] = null;

  if (category && !EMPTY_CATEGORIES.has(category)) {
    discipline = category;
    kind = 'competition';
    disciplineEvidence = 'category';
  }
  if (!discipline) {
    for (const entry of DISCIPLINE_TERMS) {
      if (hasAny(searchable, entry.terms)) {
        discipline = entry.discipline;
        disciplineDetail = entry.detail ?? null;
        kind = entry.kind;
        disciplineEvidence = hasAny(competition, entry.terms) ? 'competition' : 'title';
        break;
      }
    }
  }

  // "Unicaja" on its own (foundation, cultural venue, sponsor) never proves
  // basketball — only "Unicaja Baloncesto" or an explicit competition does.
  const base: Omit<SportsEligibility, 'eligible' | 'reason'> = {
    tier: 'omitted',
    discipline,
    disciplineDetail,
    kind,
    disciplineEvidence,
    localityVerified: false,
    municipality: null,
    awayFixture: false,
  };

  // --- 2. Provenance -------------------------------------------------------
  if (!row.source_url && !row.canonical_url) {
    return { ...base, eligible: false, reason: 'no_provenance' };
  }

  // --- 3. Arts / religious content ----------------------------------------
  const nonSport = hasAny(`${title} ${competition}`, NON_SPORT_TERMS);
  if (nonSport && disciplineEvidence !== 'category' && !discipline) {
    return { ...base, eligible: false, reason: 'non_sport_content' };
  }
  if (nonSport && disciplineEvidence !== 'title' && disciplineEvidence !== 'competition') {
    // A generic/legacy category cannot override an explicit arts signal.
    return { ...base, eligible: false, reason: 'non_sport_content' };
  }

  if (!discipline) {
    return { ...base, eligible: false, reason: 'unknown_discipline' };
  }

  // --- 4. Away fixture -----------------------------------------------------
  const away = isAwayFixture(row);
  if (away) {
    return { ...base, eligible: false, reason: 'away_fixture', awayFixture: true };
  }

  // --- 5. Locality: venue/address proves it; `city` alone is provisional ---
  const municipality =
    findMalagaMunicipality(row.venue_name) ?? findMalagaMunicipality(row.address);
  if (municipality) {
    return {
      ...base,
      tier: 'verified',
      localityVerified: true,
      municipality,
      eligible: true,
      reason: null,
    };
  }

  const cityMunicipality = findMalagaMunicipality(row.city);
  if (cityMunicipality && !isPlaceholderVenue(row.venue_name)) {
    return {
      ...base,
      tier: 'provisional',
      localityVerified: false,
      municipality: cityMunicipality,
      eligible: true,
      reason: null,
    };
  }

  return { ...base, eligible: false, reason: 'locality_unverified' };
}


export interface EligibilitySummary<T> {
  eligible: T[];
  verified: number;
  provisional: number;
  omitted: number;
  reasons: Record<IneligibilityReason, number>;
}

/** Split rows into publishable ones and an honest omission tally. */
export function filterEligibleSports<T extends SportsRowLike>(rows: readonly T[]): EligibilitySummary<T> {
  const reasons: Record<IneligibilityReason, number> = {
    non_sport_content: 0,
    unknown_discipline: 0,
    locality_unverified: 0,
    away_fixture: 0,
    no_provenance: 0,
  };
  const eligible: T[] = [];
  let verified = 0;
  let provisional = 0;
  for (const row of rows) {
    const verdict = evaluateSportsEligibility(row);
    if (verdict.eligible) {
      eligible.push(row);
      if (verdict.tier === 'verified') verified += 1;
      else provisional += 1;
    } else if (verdict.reason) {
      reasons[verdict.reason] += 1;
    }
  }
  return { eligible, verified, provisional, omitted: rows.length - eligible.length, reasons };
}

