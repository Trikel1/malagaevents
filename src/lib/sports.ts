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

/**
 * Normalize free-form sport values (from scrapers, DB or user input) to the
 * canonical i18n key used under `sports.categories.<key>`. Supports both the
 * curated Spanish taxonomy (`futbol`, `baloncesto`…) and common English/other
 * aliases (`football`, `tennis`, `basketball`, `triathlon`, `running`, …).
 */
export function normalizeSportKey(raw: string | null | undefined): string {
  if (!raw) return "other";
  const s = String(raw).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
    // canonical ES → i18n key
    futbol: "football",
    baloncesto: "basketball",
    tenis: "tennis",
    atletismo: "athletics",
    triatlon: "triathlon",
    ciclismo: "cycling",
    natacion: "swimming",
    padel: "padel",
    balonmano: "handball",
    voleibol: "volleyball",
    senderismo: "hiking",
    acuaticos: "water_sports",
    "artes marciales": "martial_arts",
    artes_marciales: "martial_arts",
    // English aliases
    football: "football",
    soccer: "football",
    basketball: "basketball",
    tennis: "tennis",
    athletics: "athletics",
    "track and field": "athletics",
    triathlon: "triathlon",
    running: "running",
    cycling: "cycling",
    swimming: "swimming",
    handball: "handball",
    volleyball: "volleyball",
    hiking: "hiking",
    fitness: "fitness",
    rugby: "rugby",
    futsal: "futsal",
    motor: "motor",
    motorsport: "motor",
    otros: "other",
    other: "other",
  };
  return map[s] ?? "other";
}

/**
 * Localised label for a sport value using the central taxonomy under
 * `sports.categories.<key>`. Never returns the raw slug — falls back to the
 * "other" bucket if the value is unknown.
 */
export function getSportLabel(
  t: (key: string, options?: unknown) => string,
  raw: string | null | undefined,
): string {
  const key = normalizeSportKey(raw);
  const localized = t(`sports.categories.${key}`);
  // If i18next returns the key unchanged (missing), fall back to "other".
  if (localized === `sports.categories.${key}`) {
    return t("sports.categories.other");
  }
  return localized;
}

