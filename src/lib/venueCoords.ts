/**
 * Venue → coordinates helpers for the Map view.
 *
 * Honesty rules (audit 2026-09-07):
 * - Coordinates are NEVER invented. There is no jitter fallback.
 * - Real coordinates stored with the event or its linked venue always win and
 *   are reported as exact.
 * - The curated catalogue below is a manual convenience list; a match is only
 *   used on an EXACT normalized name and is always reported as approximate.
 * - Anything else resolves to `null` so the UI can say "Ubicación pendiente"
 *   instead of dropping a false pin.
 */

export const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 };


// Curated venue coordinates (real venues in Málaga). Keys are normalized.
// Entries marked (OSM) were checked against OpenStreetMap/Nominatim on
// 2026-09-07; several previous values pointed at the wrong street and were
// corrected. Nothing here is generated or guessed: a venue we cannot verify
// stays out of the list and the UI says "Ubicación pendiente".
const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  'teatro cervantes': { lat: 36.7248, lng: -4.4185 }, // OSM
  'teatro echegaray': { lat: 36.7203, lng: -4.4202 },
  'teatro del soho': { lat: 36.7193, lng: -4.4254 },
  'teatro soho': { lat: 36.7193, lng: -4.4254 },
  'soho caixabank theatre': { lat: 36.7193, lng: -4.4254 },
  // Sala Trinchera: Polígono La Estrella, not the city centre. (OSM)
  'la trinchera': { lat: 36.7013, lng: -4.4676 },
  'sala trinchera': { lat: 36.7013, lng: -4.4676 },
  // Sala París 15: Calle La Orotava, Polígono San Luis. (OSM)
  'paris 15': { lat: 36.7049, lng: -4.4763 },
  'parís 15': { lat: 36.7049, lng: -4.4763 },
  'sala paris 15': { lat: 36.7049, lng: -4.4763 },
  'la cochera cabaret': { lat: 36.6923, lng: -4.4510 }, // OSM
  'la cochera': { lat: 36.6923, lng: -4.4510 },
  'fycma': { lat: 36.7061, lng: -4.4598 }, // OSM
  'fycma palacio de ferias y congresos': { lat: 36.7061, lng: -4.4598 },
  'palacio de ferias y congresos de málaga': { lat: 36.7061, lng: -4.4598 },
  'la térmica': { lat: 36.6895, lng: -4.4458 }, // OSM
  'la termica': { lat: 36.6895, lng: -4.4458 },
  'marenostrum fuengirola': { lat: 36.5394, lng: -4.6213 },
  'marenostrum castle park': { lat: 36.5394, lng: -4.6213 },
  'teatro estepona': { lat: 36.4286, lng: -5.1454 },
  'auditorio municipal de estepona': { lat: 36.4286, lng: -5.1454 },
  'teatro auditorio felipe vi': { lat: 36.4310, lng: -5.1550 }, // OSM
  'centro cultural maría victoria atencia': { lat: 36.7228, lng: -4.4220 },
  'museo picasso málaga': { lat: 36.7216, lng: -4.4183 }, // OSM
  'museo picasso': { lat: 36.7216, lng: -4.4183 },
  'museo carmen thyssen málaga': { lat: 36.7211, lng: -4.4225 },
  'centre pompidou málaga': { lat: 36.7190, lng: -4.4133 }, // OSM
  'la caja blanca': { lat: 36.7269, lng: -4.4749 }, // OSM
  'salas mingorance del archivo municipal': { lat: 36.7171, lng: -4.4231 }, // OSM
  'archivo municipal de málaga': { lat: 36.7171, lng: -4.4231 },
  'plaza de la marina puerto de málaga': { lat: 36.7177, lng: -4.4205 }, // OSM
  'plaza de la marina': { lat: 36.7177, lng: -4.4205 },
  'auditorio municipal cortijo de torres': { lat: 36.6862, lng: -4.4734 },
  'martín carpena': { lat: 36.6912, lng: -4.4828 },
  'palacio de los deportes martín carpena': { lat: 36.6912, lng: -4.4828 },
  'estadio la rosaleda': { lat: 36.7411, lng: -4.4262 },
  'la malagueta': { lat: 36.7187, lng: -4.4129 },
  'plaza de la merced': { lat: 36.7235, lng: -4.4178 },
  'plaza de la constitucion': { lat: 36.7202, lng: -4.4203 },
  'plaza de la constitución': { lat: 36.7202, lng: -4.4203 },
  'sala marte': { lat: 36.7012, lng: -4.4571 },
  'auditorio municipal de málaga': { lat: 36.6862, lng: -4.4734 },
  'auditorio eduardo ocón': { lat: 36.7228, lng: -4.4063 },
  'auditorio eduardo ocon': { lat: 36.7228, lng: -4.4063 },
  'contenedor cultural uma': { lat: 36.7156, lng: -4.4773 },
  'muelle uno': { lat: 36.7155, lng: -4.4150 },
  'cac málaga': { lat: 36.7148, lng: -4.4321 },
  'cac malaga': { lat: 36.7148, lng: -4.4321 },
  'jardín botánico la concepción': { lat: 36.7641, lng: -4.4098 },
  'jardin botanico la concepcion': { lat: 36.7641, lng: -4.4098 },
  'palacio de deportes josé maría martín carpena': { lat: 36.6912, lng: -4.4828 },
  'ciudad deportiva de carranque': { lat: 36.7172, lng: -4.4499 },
};


const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NORMALIZED_LOOKUP: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  Object.entries(VENUE_COORDS).map(([k, v]) => [normalize(k), v])
);


/** Precision reported to the user for a resolved point. */
export type CoordPrecision = 'exact' | 'approximate';

export interface ResolvedPoint {
  lat: number;
  lng: number;
  precision: CoordPrecision;
}

/**
 * Convert an unknown value into a usable coordinate number.
 * Rejects null/undefined/'' (which `Number()` turns into 0) and out-of-range
 * or non-finite values.
 */
export function toCoordNumber(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > max) return null;
  return n;
}

/** Validate a lat/lng pair. Returns null unless BOTH values are usable. */
export function toLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = toCoordNumber(lat, 90);
  const ln = toCoordNumber(lng, 180);
  if (la === null || ln === null) return null;
  // 0,0 (Null Island) is never a valid Málaga location and is the classic
  // artefact of Number(null) === 0.
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/** Curated catalogue lookup. Exact normalized name only — no partial matches. */
export function lookupVenueCoords(venueName: string | null | undefined): { lat: number; lng: number } | null {
  const norm = normalize(venueName ?? '');
  if (!norm) return null;
  return NORMALIZED_LOOKUP[norm] ?? null;
}

export interface CoordSources {
  /** Coordinates stored on the record itself. */
  lat?: unknown;
  lng?: unknown;
  /** Coordinates from the joined venue row. */
  venueLat?: unknown;
  venueLng?: unknown;
  /** Venue name, used only for the curated catalogue. */
  venueName?: string | null;
}

/**
 * Resolve a point for a record, or `null` when there is no verified location.
 * Order: own coordinates → linked venue coordinates → curated catalogue.
 */
export function resolvePoint(sources: CoordSources): ResolvedPoint | null {
  const own = toLatLng(sources.lat, sources.lng);
  if (own) return { ...own, precision: 'exact' };

  const venue = toLatLng(sources.venueLat, sources.venueLng);
  if (venue) return { ...venue, precision: 'exact' };

  const curated = lookupVenueCoords(sources.venueName);
  if (curated) return { ...curated, precision: 'approximate' };

  return null;
}

