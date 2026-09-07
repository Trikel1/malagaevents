// Honest placement + classification rules for FUTURE sports ingestion.
//
// The previous behaviour invented facts:
// - a missing venue became the source's default municipality ("Málaga"),
// - the municipality was always the source default, even when the JSON-LD
//   address named a different town,
// - `is_in_malaga_province` was derived from `province ?? "Málaga"`, so every
//   row was "in Málaga province" by construction,
// - generic sources labelled everything `other`, so processions, concerts and
//   exhibitions leaked into the sports agenda.
//
// These rules only use what the source actually published. Whatever cannot be
// established stays unknown — never "verified", never defaulted to Málaga.

import { MALAGA_MUNICIPALITIES } from "../geo/malagaMunicipalities.ts";

export function normalizePlain(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NORMALIZED_MUNICIPALITIES = MALAGA_MUNICIPALITIES.map((name) => ({
  name,
  normalized: normalizePlain(name),
}))
  // Longest first so "Alhaurín de la Torre" wins over "Alhaurín el Grande"
  // prefixes and "Vélez-Málaga" is not swallowed by "Málaga".
  .sort((a, b) => b.normalized.length - a.normalized.length);

function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^| )${needle.replace(/ /g, " ")}( |$)`).test(haystack);
}

/** First Málaga-province municipality actually named in the given texts. */
export function findMunicipality(...texts: (string | null | undefined)[]): string | null {
  const haystack = normalizePlain(texts.filter(Boolean).join(" "));
  if (!haystack) return null;
  for (const entry of NORMALIZED_MUNICIPALITIES) {
    if (containsWord(haystack, entry.normalized)) return entry.name;
  }
  return null;
}

export interface PlacementInput {
  /** Venue as published by the source (empty when it published none). */
  venueName?: string | null;
  /** Full address / location text as published. */
  address?: string | null;
  /** Locality explicitly declared by the source (e.g. JSON-LD addressLocality). */
  declaredLocality?: string | null;
  /** The source's configured default municipality — a hint, never evidence. */
  defaultMunicipality?: string | null;
}

export interface Placement {
  /** Venue, or null when the source published none. Never a municipality. */
  venueName: string | null;
  /** Municipality backed by the source, or null when unknown. */
  municipality: string | null;
  /** True only when a real venue or address places the event in the province. */
  inMalagaProvince: boolean;
  /** 'verified' needs a real venue AND a municipality named by the source. */
  locationStatus: "verified" | "unverified";
}

/** Placeholder strings that some feeds use instead of leaving the field out. */
const PLACEHOLDER_VENUES = new Set([
  "",
  "n a",
  "na",
  "not specified",
  "no specified venue",
  "no data available",
  "unknown",
  "desconocido",
  "tbd",
  "sin especificar",
  "varios",
  "por confirmar",
  // Region names are not venues: they place nothing.
  "costa del sol",
  "pabellon",
  "polideportivo",
  "null",
]);

export function isPlaceholderVenue(venue: string | null | undefined): boolean {
  return PLACEHOLDER_VENUES.has(normalizePlain(venue));
}

export function resolvePlacement(input: PlacementInput): Placement {
  const rawVenue = (input.venueName ?? "").trim();
  const venueName = rawVenue && !isPlaceholderVenue(rawVenue) ? rawVenue : null;

  // A municipality is only accepted when the source names it: in the declared
  // locality, in the address, or inside the venue name itself.
  const declared = findMunicipality(input.declaredLocality);
  const municipality =
    declared ?? findMunicipality(input.address) ?? findMunicipality(venueName);

  // The configured default is a hint about where the source usually reports
  // from; it does not prove where this particular event happens.
  const inMalagaProvince = municipality !== null;

  return {
    venueName,
    municipality,
    inMalagaProvince,
    locationStatus: venueName && municipality ? "verified" : "unverified",
  };
}

// ---------------------------------------------------------------------------
// Discipline / non-sport classification
// ---------------------------------------------------------------------------

const DISCIPLINE_TERMS: Array<[string, string[]]> = [
  ["futbol", ["futbol", "football", "liga ea sports", "futbol sala", "futsal"]],
  ["baloncesto", ["baloncesto", "basket", "basquet", "acb"]],
  ["balonmano", ["balonmano", "handball"]],
  ["voleibol", ["voleibol", "volley", "voley"]],
  ["atletismo", ["atletismo", "carrera", "10k", "5k", "media maraton", "maraton", "cross", "trail"]],
  ["ciclismo", ["ciclismo", "btt", "mtb", "gran fondo", "trialbici", "cicloturista"]],
  ["natacion", ["natacion", "travesia a nado", "waterpolo"]],
  ["padel", ["padel"]],
  ["tenis", ["tenis", "atp", "wta"]],
  ["golf", ["golf"]],
  ["motor", ["motociclismo", "automovilismo", "rally", "karting", "vespa", "scooter", "motoclub", "concentracion motera"]],
  ["nauticos", ["vela", "regata", "surf", "paddle surf", "piragüismo", "piraguismo", "kayak"]],
  ["hipica", ["hipica", "concurso de saltos", "doma"]],
  ["escalada", ["escalada", "boulder"]],
  ["ajedrez", ["ajedrez"]],
  ["gimnasia", ["gimnasia", "ritmica"]],
  ["boxeo", ["boxeo", "kickboxing", "mma"]],
  ["senderismo", ["senderismo", "marcha nordica", "ruta a pie"]],
];

/** Explicitly non-sport content that must never enter the sports agenda. */
const NON_SPORT_TERMS = [
  "procesion",
  "semana santa",
  "cofradia",
  "via crucis",
  "concierto",
  "recital",
  "flamenco",
  "flamenca",
  "exposicion",
  "teatro",
  "musical",
  "opera",
  "zarzuela",
  "cine",
  "feria del libro",
  "belen",
  "cabalgata",
  "misa",
  "romeria",
  "verbena",
];

export interface Classification {
  /** Discipline named by the source, or null when it cannot be established. */
  discipline: string | null;
  /** True when the text is explicitly non-sport content. */
  isNonSport: boolean;
}

/**
 * Classify from the actual source text. Charity races and scooter meets stay
 * in (they are genuine sporting activities even when culturally adjacent), but
 * a procession or a concert is rejected unless a positive sports term appears.
 */
export function classifyDiscipline(
  ...texts: (string | null | undefined)[]
): Classification {
  const haystack = normalizePlain(texts.filter(Boolean).join(" "));
  if (!haystack) return { discipline: null, isNonSport: false };

  let discipline: string | null = null;
  for (const [name, terms] of DISCIPLINE_TERMS) {
    if (terms.some((term) => containsWord(haystack, normalizePlain(term)))) {
      discipline = name;
      break;
    }
  }

  const nonSportHit = NON_SPORT_TERMS.some((term) =>
    containsWord(haystack, normalizePlain(term))
  );

  // A positive sports signal wins: "carrera solidaria por la cofradía" is a
  // real race; "procesión de la Virgen" is not.
  return { discipline, isNonSport: nonSportHit && discipline === null };
}
