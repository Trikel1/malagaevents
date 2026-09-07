// Link a duty row to its directory entry.
//
// pharmacies_guard rows come from the official duty portal, which publishes an
// address and nothing else — no pharmacy name, no phone, no coordinates:
//
//   "AV. RICARDO SORIANO, 4"     "C/CAMILO JOSE CELA, 13"
//
// pharmacies_directory holds the same pharmacies with their real name, phone
// and coordinates, but written differently:
//
//   "Avenida Ricardo Soriano 4, 29601, Marbella"   -> Farmacia Berdaguer
//
// Matching them lets a duty card offer "Llamar" and precise "Cómo llegar"
// without inventing anything: every value shown still comes from the official
// directory. The match is deliberately strict — same municipality, same house
// number, strong street-name overlap, and exactly one candidate. Anything
// ambiguous stays unmatched and the card degrades honestly.

import { resolveMunicipalitySlug, normalizeMunicipalityKey } from '@/lib/pharmacyMunicipality';

const STREET_TYPES: Record<string, string> = {
  c: 'calle', cl: 'calle', calle: 'calle',
  av: 'avenida', avd: 'avenida', avda: 'avenida', avenida: 'avenida',
  pz: 'plaza', pza: 'plaza', plz: 'plaza', plaza: 'plaza',
  ctra: 'carretera', crta: 'carretera', cra: 'carretera', carretera: 'carretera',
  urb: 'urbanizacion', urbanizacion: 'urbanizacion',
  ps: 'paseo', pso: 'paseo', paseo: 'paseo',
  cmno: 'camino', camino: 'camino',
  bda: 'barriada', barriada: 'barriada',
};

/** Spanish stop words and postal noise that carry no matching signal. */
const NOISE = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'n', 'num', 'no', 'sn', 'local', 'esquina']);

export interface AddressTokens {
  /** Street-name words, normalised, without street type or numbers. */
  words: string[];
  /** House number when the address publishes one. */
  number: string | null;
}

const isPostalCode = (tok: string) => /^\d{5}$/.test(tok);

export const parseAddress = (raw: string | null | undefined): AddressTokens => {
  if (!raw) return { words: [], number: null };

  const flat = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const rawTokens = flat.split(' ').filter(Boolean);

  const words: string[] = [];
  const numbers: string[] = [];

  for (const tok of rawTokens) {
    if (isPostalCode(tok)) continue;              // 29601
    if (/^\d+$/.test(tok)) { numbers.push(tok); continue; }
    if (/^km$/.test(tok)) { words.push('km'); continue; }
    if (NOISE.has(tok)) continue;
    words.push(STREET_TYPES[tok] ?? tok);
  }

  // The house number is the first standalone number after the street name.
  return { words, number: numbers.length > 0 ? numbers[0] : null };
};

/**
 * Jaccard-style overlap over the street-name words, ignoring the street type
 * and any town/locality words the address repeats ("…, 29601, Marbella").
 */
export const streetOverlap = (a: AddressTokens, b: AddressTokens, townWords: Set<string> = new Set()): number => {
  const strip = (t: AddressTokens) =>
    new Set(
      t.words.filter((w) => !Object.values(STREET_TYPES).includes(w) && !townWords.has(w))
    );
  const sa = strip(a);
  const sb = strip(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared += 1;
  return shared / Math.max(sa.size, sb.size);
};

export interface DirectoryLike {
  id?: string;
  name?: string;
  address: string;
  municipality?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface GuardLike {
  address: string;
  municipality?: string | null;
}

/** Minimum street-word overlap required to accept a match. */
const MIN_OVERLAP = 0.75;

/**
 * Find the one directory entry that unambiguously corresponds to a duty row.
 * Returns null when there is no candidate, or more than one equally good one.
 */
export const findDirectoryMatch = <T extends DirectoryLike>(
  guard: GuardLike,
  directory: T[]
): T | null => {
  const g = parseAddress(guard.address);
  if (g.words.length === 0) return null;

  const guardSlug = resolveMunicipalitySlug(guard.municipality);
  const guardKey = normalizeMunicipalityKey(guard.municipality);

  // Town words repeated inside the address itself carry no matching signal.
  const townWords = new Set(
    [guard.municipality, ...directory.map((d) => d.municipality)]
      .flatMap((m) => normalizeMunicipalityKey(m).split(' '))
      .filter(Boolean)
  );

  const sameTown = directory.filter((d) => {
    const dSlug = resolveMunicipalitySlug(d.municipality);
    if (guardSlug && dSlug) return guardSlug === dSlug;
    return !!guardKey && guardKey === normalizeMunicipalityKey(d.municipality);
  });
  if (sameTown.length === 0) return null;

  const scored = sameTown
    .map((d) => {
      const parsed = parseAddress(d.address);
      // A published house number on both sides must agree. When the duty row
      // has a number and the directory entry does not (or vice versa), the
      // pair is too weak to trust.
      if (g.number !== parsed.number) return null;
      const overlap = streetOverlap(g, parsed, townWords);
      if (overlap < MIN_OVERLAP) return null;
      return { entry: d, overlap };
    })
    .filter((x): x is { entry: T; overlap: number } => x !== null)
    .sort((a, b) => b.overlap - a.overlap);

  if (scored.length === 0) return null;
  // Ambiguous: two directory entries fit the same address equally well.
  if (scored.length > 1 && scored[1].overlap === scored[0].overlap) return null;

  return scored[0].entry;
};
