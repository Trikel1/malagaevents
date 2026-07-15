/**
 * Shared sports utilities (pure, frontend-safe).
 * Edge functions duplicate the logic locally (no cross-runtime imports).
 */

const HOME_AWAY_TOKENS = /\s*[\(\[]\s*(home|away|local|visitante|visitor|fuera|casa)\s*[\)\]]/gi;
const KNOWN_BRANDS = /(M[aá]laga\s*CF|Unicaja|ACB|LaLiga|Liga\s*Endesa|EuroCup|Copa\s*del\s*Rey|Ironman|Zurich)/i;

const SMALL_WORDS = new Set(["de", "la", "el", "los", "las", "y", "vs", "del", "en", "al", "a"]);

function smartTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      // Preserve all-caps tokens that look like acronyms (CF, FC, UD, RCD)
      if (/^[A-Z]{2,4}$/.test(input.split(" ")[i] || "")) return input.split(" ")[i];
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Clean ugly scraped sports titles for display. Never throws. */
export function cleanSportTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  let t = String(raw)
    .replace(HOME_AWAY_TOKENS, " ")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If shouted in caps and not a known brand, smart-case it.
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑ]/g, "");
  const upperRatio = letters ? letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / letters.length : 0;
  if (t.length > 12 && upperRatio > 0.85 && !KNOWN_BRANDS.test(t)) {
    t = smartTitleCase(t);
  }
  return t;
}

/** Detect whether a URL looks like a registration/inscription link. */
export function isRegistrationUrl(url?: string | null): boolean {
  if (!url) return false;
  return /inscrip|register|signup|sign-up|registr|enroll/i.test(url);
}

/** Detect free events from price_info. */
export function isFreeEvent(priceInfo?: string | null): boolean {
  if (!priceInfo) return false;
  return /\b(gratis|free|libre|gratuit\w*|sin coste|0\s*€)\b/i.test(priceInfo);
}

/** Build a map directions URL from venue info. */
export function buildDirectionsUrl(
  venue?: string | null,
  city?: string | null,
  address?: string | null,
): string | null {
  const parts = [venue, address, city].filter(Boolean).join(", ");
  if (!parts.trim()) return null;
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const q = encodeURIComponent(parts);
  return isIOS
    ? `maps://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Canonical Málaga province municipalities for chips/filters (curated subset). */
export const MALAGA_MUNICIPALITIES = [
  "Málaga",
  "Marbella",
  "Fuengirola",
  "Benalmádena",
  "Torremolinos",
  "Vélez-Málaga",
  "Mijas",
  "Estepona",
  "Antequera",
  "Ronda",
  "Nerja",
  "Rincón de la Victoria",
  "Alhaurín de la Torre",
  "Cártama",
  "Coín",
] as const;

export type MalagaMunicipality = (typeof MALAGA_MUNICIPALITIES)[number];
