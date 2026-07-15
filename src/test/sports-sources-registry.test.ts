import { describe, it, expect } from "vitest";

// Pure validation helpers exercised via tests (matches server-side expectations)
const VALID_TYPES = new Set(["html", "ics", "rss", "json"]);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isValidSourceType(t: string): boolean {
  return VALID_TYPES.has(t);
}
function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s) && s.length >= 3 && s.length <= 80;
}

// Seed catalog mirrors the migration seed — keep in sync.
const MVP_SOURCES = [
  { slug: "malaga-capital-deportes", municipality: "Málaga", type: "html" },
  { slug: "diputacion-malaga-deportes", municipality: null, type: "html" },
  { slug: "torremolinos-deportes", municipality: "Torremolinos", type: "html" },
  { slug: "rincon-victoria-deportes", municipality: "Rincón de la Victoria", type: "html" },
  { slug: "fuengirola-deportes", municipality: "Fuengirola", type: "html" },
  { slug: "velez-malaga-deportes", municipality: "Vélez-Málaga", type: "html" },
  { slug: "ronda-turismo-agenda", municipality: "Ronda", type: "html" },
  { slug: "unicaja-baloncesto", municipality: "Málaga", type: "html" },
];

describe("sports source registry — MVP catalog", () => {
  it("has exactly 8 sources", () => {
    expect(MVP_SOURCES).toHaveLength(8);
  });

  it("every slug is valid and unique", () => {
    const slugs = MVP_SOURCES.map((s) => s.slug);
    for (const slug of slugs) expect(isValidSlug(slug)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every source_type is one of html|ics|rss|json", () => {
    for (const s of MVP_SOURCES) expect(isValidSourceType(s.type)).toBe(true);
  });

  it("resolves a source by slug", () => {
    const resolve = (slug: string) => MVP_SOURCES.find((s) => s.slug === slug) ?? null;
    expect(resolve("unicaja-baloncesto")?.municipality).toBe("Málaga");
    expect(resolve("ronda-turismo-agenda")?.municipality).toBe("Ronda");
    expect(resolve("nope")).toBeNull();
  });
});

describe("sports source validators", () => {
  it("rejects invalid slugs", () => {
    expect(isValidSlug("Málaga")).toBe(false);
    expect(isValidSlug("with_underscore")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
  });

  it("rejects unknown source types", () => {
    expect(isValidSourceType("csv")).toBe(false);
    expect(isValidSourceType("scrape")).toBe(false);
    expect(isValidSourceType("html")).toBe(true);
  });
});
