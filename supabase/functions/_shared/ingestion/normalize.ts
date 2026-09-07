// Text normalization helpers. Used ONLY for comparison / dedupe.
// Display values must keep the original casing and accents.

export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D`´]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/^(concierto|espectaculo|show|evento)\s+de\s+/i, "")
    .trim();
}

export function normalizeVenueName(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/^(teatro|sala|auditorio|centro|palacio)\s+/i, (m) => m)
    .trim();
}

export function normalizeLocality(value: string | null | undefined): string {
  const n = normalizeText(value);
  // canonicalise "malaga ciudad" -> "malaga"
  if (n === "malaga ciudad" || n === "ciudad de malaga") return "malaga";
  return n;
}

export function collapseWhitespace(value: string | null | undefined): string {
  return (value ?? "").toString().replace(/\s+/g, " ").trim();
}

export function stableHash(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", enc).then((buf) => {
    const bytes = new Uint8Array(buf);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  });
}

// ---------------------------------------------------------------------------
// Category canonicalisation.
//
// Auditoría 2026-09-07: varias fuentes (sobre todo el CSV de datos abiertos del
// Ayuntamiento) escribían la categoría en crudo y en español ("Cursos y
// talleres", "Fiestas populares", "Música"...). Los filtros de la app consultan
// `category` con las claves canónicas en inglés, así que esos eventos quedaban
// fuera de cualquier filtro. Esta función traduce la categoría de origen a la
// clave canónica antes de escribir.
// ---------------------------------------------------------------------------

export const CANONICAL_CATEGORIES = [
  "music",
  "theater",
  "exhibitions",
  "kids",
  "sports",
  "festivals",
  "workshops",
  "conferences",
  "nightlife",
  "other",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Array<{ id: CanonicalCategory; keywords: string[] }> = [
  { id: "kids", keywords: ["kids", "infantil", "familia", "familiar", "ninos", "publico infantil"] },
  { id: "workshops", keywords: ["workshop", "taller", "curso", "formacion", "cursos y talleres"] },
  { id: "conferences", keywords: ["conference", "conferencia", "charla", "congreso", "jornada", "presentacion", "encuentro"] },
  { id: "exhibitions", keywords: ["exhibition", "exposicion", "museo", "muestra", "arte", "galeria", "ferias exposiciones y museos"] },
  { id: "festivals", keywords: ["festival", "fiesta", "feria", "verbena", "romeria", "carnaval", "procesion", "actos religiosos"] },
  { id: "sports", keywords: ["sport", "deporte", "carrera", "maraton", "torneo"] },
  { id: "nightlife", keywords: ["nightlife", "ocio nocturno", "discoteca", "club nocturno", "dj"] },
  { id: "music", keywords: ["music", "musica", "concierto", "flamenco", "recital", "opera", "zarzuela"] },
  { id: "theater", keywords: ["theater", "theatre", "teatro", "espectaculo", "danza", "circo", "cine", "magia", "monologo", "artes escenicas"] },
];

export function canonicalCategory(raw: string | null | undefined): CanonicalCategory {
  const normalized = normalizeText(raw);
  if (!normalized) return "other";
  if ((CANONICAL_CATEGORIES as readonly string[]).includes(normalized)) {
    return normalized as CanonicalCategory;
  }
  for (const { id, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (normalized.includes(normalizeText(keyword))) return id;
    }
  }
  return "other";
}
