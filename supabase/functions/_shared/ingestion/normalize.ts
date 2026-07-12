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
