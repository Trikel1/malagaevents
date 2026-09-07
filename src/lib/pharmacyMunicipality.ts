// Municipality matching for the pharmacies section.
//
// WHY THIS EXISTS (regression root cause, 2026-09-07)
// ---------------------------------------------------
// `pharmacies_guard.municipality` is written verbatim from the official portal
// zone label (farmaciasguardia.farmaceuticos.com, provincia 29). Those labels
// are unaccented, title-cased and occasionally carry a trailing dot, an
// inverted article or a source-side typo:
//
//   "Alhaurin De La Torre"   "Velez-Malaga"   "Cartama"   "Coin"
//   "Casarabonela."          "Burgo (El)"     "Fuengilora" (sic)
//
// The UI filter, however, offers the curated catalog display names
// ("Alhaurín de la Torre", "Vélez-Málaga", "Cártama", "Coín"). Querying with
// `.eq('municipality', <catalog name>)` therefore matched ONLY "Málaga" —
// every other municipality returned zero duty rows even though the rows were
// there. The directory table has the same problem plus accent variants of its
// own ("Benalmadena" / "Benalmádena", "Alhaurin de la Torre" / "Alhaurín…").
//
// So: never compare these strings raw. Normalise both sides and compare
// through the existing locality catalog. No parallel catalog is introduced —
// this module only maps source spellings onto `LOCALITIES_CATALOG`.

import { LOCALITIES_CATALOG } from '@/lib/localitiesCatalog';

/**
 * Fold a municipality string into a comparable key: lowercase, no diacritics,
 * punctuation collapsed to single spaces, trailing article inverted.
 * "Burgo (El)" -> "el burgo", "Casarabonela." -> "casarabonela".
 */
export const normalizeMunicipalityKey = (raw: string | null | undefined): string => {
  if (!raw) return '';
  let s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  // "burgo el" / "cala de mijas la" -> "el burgo" / "la cala de mijas"
  const inverted = s.match(/^(.*?)\s+(el|la|los|las)$/);
  if (inverted) s = `${inverted[2]} ${inverted[1]}`;

  return s.replace(/\s+/g, ' ').trim();
};

/**
 * Localities, districts and source-side misspellings that belong to a
 * municipality in the catalog. Keys are already normalised.
 * Every entry here is a documented spelling seen in the real source data;
 * ambiguous labels are deliberately left out (see UNRESOLVED_SOURCE_LABELS).
 */
const LOCALITY_TO_MUNICIPALITY_SLUG: Record<string, string> = {
  // Málaga capital districts / annexed villages
  'campanillas': 'malaga',
  'churriana': 'malaga',
  'puerto de la torre': 'malaga',
  'el palo': 'malaga',
  'pedregalejo': 'malaga',
  'teatinos': 'malaga',
  // Rincón de la Victoria
  'la cala de moral': 'rincon-de-la-victoria',
  'la cala del moral': 'rincon-de-la-victoria',
  'cala del moral': 'rincon-de-la-victoria',
  'torre de benagalbon': 'rincon-de-la-victoria',
  'benagalbon': 'rincon-de-la-victoria',
  // Vélez-Málaga
  'torre del mar': 'velez-malaga',
  'caleta de velez': 'velez-malaga',
  'almayate': 'velez-malaga',
  'benajarafe': 'velez-malaga',
  'chilches': 'velez-malaga',
  // Benalmádena
  'arroyo de la miel': 'benalmadena',
  'benalmadena costa': 'benalmadena',
  // Mijas
  'la cala de mijas': 'mijas',
  'mijas costa': 'mijas',
  'las lagunas': 'mijas',
  // Algarrobo
  'algarrobo costa': 'algarrobo',
  // Antequera
  'bobadilla estacion': 'antequera',
  'bobadilla': 'antequera',
  // Cártama
  'cartama estacion': 'cartama',
  'estacion de cartama': 'cartama',
  // Source-side typo observed in pharmacies_guard
  'fuengilora': 'fuengirola',
};

/**
 * Source labels we intentionally do NOT resolve to a municipality, because the
 * portal string is genuinely ambiguous. Rows carrying these labels still show
 * under "Toda la provincia"; they are never silently attributed to a town.
 */
export const UNRESOLVED_SOURCE_LABELS = ['costa', 'estacion', 'varios'];

/** normalised key -> catalog slug */
const KEY_TO_SLUG: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const entry of LOCALITIES_CATALOG) {
    const keys = [entry.name, entry.slug, ...(entry.aliases ?? [])];
    for (const k of keys) {
      const nk = normalizeMunicipalityKey(k);
      if (nk && !map.has(nk)) map.set(nk, entry.slug);
    }
    // slugs are hyphenated ("rincon-de-la-victoria"); normalisation already
    // turns hyphens into spaces, so this is covered above.
  }
  for (const [locality, slug] of Object.entries(LOCALITY_TO_MUNICIPALITY_SLUG)) {
    map.set(normalizeMunicipalityKey(locality), slug);
  }
  return map;
})();

/**
 * Resolve any municipality/locality string (catalog name, portal label,
 * directory spelling) to a catalog slug, or null when it cannot be resolved
 * with confidence.
 */
export const resolveMunicipalitySlug = (raw: string | null | undefined): string | null => {
  const key = normalizeMunicipalityKey(raw);
  if (!key) return null;
  if (UNRESOLVED_SOURCE_LABELS.includes(key)) return null;
  return KEY_TO_SLUG.get(key) ?? null;
};

/**
 * True when a data row's municipality refers to the municipality the user
 * picked in the UI. Falls back to a normalised string comparison so rows whose
 * town is outside the curated catalog still match an equal spelling.
 */
export const matchesMunicipality = (
  rowMunicipality: string | null | undefined,
  selectedMunicipality: string | null | undefined
): boolean => {
  const selectedKey = normalizeMunicipalityKey(selectedMunicipality);
  if (!selectedKey) return true; // no filter = province-wide

  const rowKey = normalizeMunicipalityKey(rowMunicipality);
  if (!rowKey) return false;
  if (rowKey === selectedKey) return true;

  const selectedSlug = resolveMunicipalitySlug(selectedMunicipality);
  const rowSlug = resolveMunicipalitySlug(rowMunicipality);
  return !!selectedSlug && selectedSlug === rowSlug;
};
