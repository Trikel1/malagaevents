/**
 * Venue → coordinates fallback for the Map view.
 * Used ONLY when an event lacks lat/lng so the map is not empty for demo.
 * Real coordinates from the database always take precedence.
 */

export const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 };

// Curated venue coordinates (real venues in Málaga). Keys are normalized.
const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  'teatro cervantes': { lat: 36.7245, lng: -4.4170 },
  'teatro echegaray': { lat: 36.7203, lng: -4.4202 },
  'teatro del soho': { lat: 36.7193, lng: -4.4254 },
  'teatro soho': { lat: 36.7193, lng: -4.4254 },
  'soho caixabank theatre': { lat: 36.7193, lng: -4.4254 },
  'la trinchera': { lat: 36.7196, lng: -4.4302 },
  'paris 15': { lat: 36.7178, lng: -4.4195 },
  'parís 15': { lat: 36.7178, lng: -4.4195 },
  'la cochera cabaret': { lat: 36.7008, lng: -4.4438 },
  'la cochera': { lat: 36.7008, lng: -4.4438 },
  'la garrapata': { lat: 36.7228, lng: -4.4295 },
  'fycma': { lat: 36.6859, lng: -4.4760 },
  'palacio de ferias y congresos de málaga': { lat: 36.6859, lng: -4.4760 },
  'la térmica': { lat: 36.7165, lng: -4.4477 },
  'la termica': { lat: 36.7165, lng: -4.4477 },
  'marenostrum fuengirola': { lat: 36.5394, lng: -4.6213 },
  'marenostrum castle park': { lat: 36.5394, lng: -4.6213 },
  'teatro estepona': { lat: 36.4286, lng: -5.1454 },
  'auditorio municipal de estepona': { lat: 36.4286, lng: -5.1454 },
  'centro cultural maría victoria atencia': { lat: 36.7228, lng: -4.4220 },
  'museo picasso málaga': { lat: 36.7223, lng: -4.4178 },
  'museo carmen thyssen málaga': { lat: 36.7211, lng: -4.4225 },
  'centre pompidou málaga': { lat: 36.7173, lng: -4.4136 },
  'auditorio municipal cortijo de torres': { lat: 36.6862, lng: -4.4734 },
  'martín carpena': { lat: 36.6912, lng: -4.4828 },
  'palacio de los deportes martín carpena': { lat: 36.6912, lng: -4.4828 },
  'estadio la rosaleda': { lat: 36.7411, lng: -4.4262 },
  'la malagueta': { lat: 36.7187, lng: -4.4129 },
  'plaza de la merced': { lat: 36.7235, lng: -4.4178 },
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

export interface ResolvedCoord {
  lat: number;
  lng: number;
  approximate: boolean;
}

/**
 * Resolve coordinates for a venue name with small jittered fallback to
 * Málaga center so demo markers don't all stack on top of each other.
 */
export function mapVenueToCoords(
  venueName: string | null | undefined,
  seed: string = ''
): ResolvedCoord {
  const norm = normalize(venueName ?? '');
  if (norm) {
    // Exact match first
    const exact = NORMALIZED_LOOKUP[norm];
    if (exact) return { ...exact, approximate: false };
    // Partial match (contains)
    for (const [key, coords] of Object.entries(NORMALIZED_LOOKUP)) {
      if (norm.includes(key) || key.includes(norm)) {
        return { ...coords, approximate: false };
      }
    }
  }
  // Deterministic jitter around Málaga center based on seed
  let h = 0;
  const src = (seed || venueName || 'malaga') + '';
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  const dLat = ((h & 0xff) / 255 - 0.5) * 0.04; // ~ ±2km
  const dLng = (((h >> 8) & 0xff) / 255 - 0.5) * 0.05;
  return {
    lat: MALAGA_CENTER.lat + dLat,
    lng: MALAGA_CENTER.lng + dLng,
    approximate: true,
  };
}
