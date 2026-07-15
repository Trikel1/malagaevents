import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSportsHtml, extractJsonLdBlocks, discoverIcsUrls } from "../../supabase/functions/_shared/sports-sync/adapters/html";
import { parseSportsIcs } from "../../supabase/functions/_shared/sports-sync/adapters/ics";
import { isAllowedByRobots } from "../../supabase/functions/_shared/sports-sync/robots";

function fixture(name: string): string {
  return readFileSync(
    resolve(__dirname, "../../supabase/functions/_shared/sports-sync/__fixtures__", name),
    "utf-8",
  );
}

describe("HTML JSON-LD extraction", () => {
  it("extracts every ld+json block regardless of attribute order", () => {
    const html = `
      <script type="application/ld+json">{"@type":"Event","name":"A","startDate":"2099-01-01"}</script>
      <script data-x type='application/ld+json' >{"@type":"Event","name":"B","startDate":"2099-01-02"}</script>
      <script type="application/ld+json">not json</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks.length).toBe(2);
  });
});

describe("parseSportsHtml — Málaga capital fixture", () => {
  const html = fixture("malaga-capital.html");
  const events = parseSportsHtml(html, {
    sourceName: "malaga-capital-deportes",
    sourceUrl: "https://deporte.malaga.eu/agenda/",
    defaultMunicipality: "Málaga",
    defaultCategory: "other",
  });

  it("keeps future events and drops archived ones outside the window", () => {
    const titles = events.map((e) => e.title);
    expect(titles).toContain("Carrera Popular Ciudad de Málaga 10K");
    expect(titles).toContain("Torneo de baloncesto 3x3 Málaga");
    // Old event from 2019 must be filtered out by the future-window guard.
    expect(titles.some((t) => t.startsWith("Curso permanente"))).toBe(false);
  });

  it("maps organizer, offer and canonical URL correctly", () => {
    const carrera = events.find((e) => e.title.startsWith("Carrera Popular"))!;
    expect(carrera.organizer_name).toContain("Ayuntamiento de Málaga");
    expect(carrera.organizer_email).toBe("deporte@malaga.eu");
    expect(carrera.price_amount).toBe(10);
    expect(carrera.price_currency).toBe("EUR");
    expect(carrera.canonical_url).toBe("https://deporte.malaga.eu/agenda/carrera-popular-10k-2026");
    expect(carrera.venue_name).toBe("Paseo del Parque");
    expect(carrera.address).toContain("29001");
  });

  it("maps schema.org eventStatus to canonical status", () => {
    const cancelled = events.find((e) => e.title.startsWith("Torneo de baloncesto"))!;
    expect(cancelled.status).toBe("cancelled");
  });

  it("assigns stable external_id derived from url", () => {
    const carrera = events.find((e) => e.title.startsWith("Carrera Popular"))!;
    expect(carrera.external_id).toContain("carrera-popular-10k-2026");
  });
});

describe("parseSportsHtml — Torremolinos fixture", () => {
  const html = fixture("torremolinos.html");
  const events = parseSportsHtml(html, {
    sourceName: "torremolinos-deportes",
    sourceUrl: "https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/",
    defaultMunicipality: "Torremolinos",
    defaultCategory: "other",
  });

  it("parses multiple events from an array-shaped JSON-LD block", () => {
    expect(events.length).toBe(2);
    expect(events.map((e) => e.municipality)).toEqual(["Torremolinos", "Torremolinos"]);
  });
});

describe("discoverIcsUrls", () => {
  it("finds .ics hrefs and resolves relative paths", () => {
    const html = `<a href="/agenda/exportar.ics">A</a><a href="https://ex.com/x.ics?y=1">B</a>`;
    const urls = discoverIcsUrls(html, "https://deporte.malaga.eu/agenda/");
    expect(urls).toContain("https://deporte.malaga.eu/agenda/exportar.ics");
    expect(urls).toContain("https://ex.com/x.ics?y=1");
  });

  it("returns [] when the page has no calendar export link", () => {
    expect(discoverIcsUrls("<p>nothing here</p>", "https://x.com")).toEqual([]);
  });
});

describe("parseSportsIcs — Unicaja fixture", () => {
  const ics = fixture("unicaja.ics");
  const events = parseSportsIcs(ics, {
    sourceName: "unicaja-baloncesto",
    sourceUrl: "https://www.unicajabaloncesto.com/calendario",
    defaultMunicipality: "Málaga",
    defaultCategory: "basketball",
  });

  it("keeps events inside the future window and drops historical ones", () => {
    expect(events.length).toBe(2);
    expect(events.map((e) => e.title)).toEqual(
      expect.arrayContaining([
        "Unicaja vs Real Madrid — Liga Endesa",
        "Unicaja vs Panathinaikos — BCL",
      ]),
    );
    // 1999 event MUST be filtered by the -30d..+180d window.
    expect(events.some((e) => e.title.startsWith("Partido histórico"))).toBe(false);
  });

  it("preserves original UID as external_id (dedupe stability)", () => {
    const e = events.find((x) => x.title.includes("Real Madrid"))!;
    expect(e.external_id).toBe("unicaja-2026-10-05-liga-endesa@unicajabaloncesto.com");
  });

  it("maps TENTATIVE STATUS to postponed", () => {
    const t = events.find((x) => x.title.includes("Panathinaikos"))!;
    expect(t.status).toBe("postponed");
  });

  it("normalizes TZID Europe/Madrid to +01:00 offset", () => {
    const e = events.find((x) => x.title.includes("Real Madrid"))!;
    // Naive DTSTART with TZID should end up as a parseable ISO with tz suffix.
    expect(Date.parse(e.starts_at)).not.toBeNaN();
  });
});

describe("robots.txt policy", () => {
  it("blocks a disallowed prefix under User-agent: *", () => {
    const txt = `User-agent: *\nDisallow: /agenda/private\n`;
    expect(
      isAllowedByRobots(txt, "https://x.com/agenda/private/list").allowed,
    ).toBe(false);
    expect(
      isAllowedByRobots(txt, "https://x.com/agenda/public/list").allowed,
    ).toBe(true);
  });

  it("respects Allow overriding a broader Disallow (longest match)", () => {
    const txt = `User-agent: *\nDisallow: /agenda/\nAllow: /agenda/public/\n`;
    expect(isAllowedByRobots(txt, "https://x.com/agenda/public/x").allowed).toBe(true);
    expect(isAllowedByRobots(txt, "https://x.com/agenda/private/x").allowed).toBe(false);
  });

  it("treats absent rules as allowed", () => {
    expect(isAllowedByRobots("", "https://x.com/a").allowed).toBe(true);
  });

  it("prefers a specific user-agent block over the wildcard", () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: MalagaEventsSportsBot\nAllow: /\n`;
    expect(isAllowedByRobots(txt, "https://x.com/anywhere").allowed).toBe(true);
  });
});
