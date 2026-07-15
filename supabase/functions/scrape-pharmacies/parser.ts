// Pure parser for the official portal:
//   https://farmaciasguardia.farmaceuticos.com/web_guardias/Guardias.asp
// The HTML is windows-1252, tabular ASP output. Sections use inline color styles:
//   #a352ae (purple)  -> municipality/sector heading
//   #7baf0f (green)   -> pharmacy address entry ("<ADDRESS> - <SECTOR>")
// Time-slot blocks are announced with headers like:
//   "GUARDIAS TODO EL DÍA", "GUARDIAS DIURNAS", "GUARDIAS NOCTURNAS", or
//   "DE 9:30 DE HOY A 9:30 DE MAÑANA".
//
// No pharmacy name is emitted by the portal, so we synthesise a stable
// human-readable name from address + municipality (never claim opening hours
// unless the portal announced them).

export interface ParsedGuardRow {
  /** e.g. "Farmacia · Alameda Principal, 2" — synthesised from address */
  name: string;
  address: string;
  /** Municipality name in title case, e.g. "Málaga", "Antequera" */
  municipality: string;
  /** Sector/zone label from the section header, verbatim if available */
  sector: string | null;
  /** Verbatim schedule label, e.g. "GUARDIAS TODO EL DÍA" or null */
  duty_hours: string | null;
  /** Full source URL used to fetch this row */
  source_ref: string;
  /** Query date in YYYY-MM-DD (Europe/Madrid) */
  duty_date: string;
}

export interface ParsedResult {
  available: boolean;
  rows: ParsedGuardRow[];
}

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&iacute;/gi, 'í')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#225;/g, 'á').replace(/&#233;/g, 'é').replace(/&#237;/g, 'í')
    .replace(/&#243;/g, 'ó').replace(/&#250;/g, 'ú').replace(/&#241;/g, 'ñ')
    .replace(/&#193;/g, 'Á').replace(/&#201;/g, 'É').replace(/&#205;/g, 'Í')
    .replace(/&#211;/g, 'Ó').replace(/&#218;/g, 'Ú').replace(/&#209;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();

/** Capitalise "ANTEQUERA" -> "Antequera", preserve real accents in mixed case. */
const toTitleCase = (s: string): string => {
  const lower = s.toLowerCase();
  return lower.replace(/\b([a-záéíóúñü])/g, (c) => c.toUpperCase());
};

/**
 * Convert a portal municipality label to the canonical value used across
 * the app. Málaga capital sectors ("SECTOR CENTRO", "BARRIADA CHURRIANA")
 * all collapse to "Málaga".
 */
export const canonicalMunicipality = (raw: string, zoneLabel?: string): string => {
  const cleaned = clean(raw);
  const up = stripAccents(cleaned).toUpperCase();
  if (
    up.startsWith('SECTOR ') ||
    up.startsWith('BARRIADA ') ||
    up === 'MALAGA' ||
    up === 'MALAGA CAPITAL'
  ) {
    return 'Málaga';
  }
  // If the zone we queried is Málaga capital, force capital.
  if (zoneLabel && stripAccents(zoneLabel).toLowerCase().includes('malaga capital')) {
    return 'Málaga';
  }
  return toTitleCase(cleaned);
};

/**
 * Parse the raw HTML returned by Guardias.asp for a specific zone+date.
 * `sourceRef` should be the exact URL fetched; `duty_date` is the target date.
 * `zoneLabel` is the human label of the queried zone (used as a fallback
 * municipality for province-wide zones that don't emit a purple header).
 */
export function parseOfficialGuardHtml(
  html: string,
  opts: { source_ref: string; duty_date: string; zone_label?: string }
): ParsedResult {
  if (!html || /Datos\s+no\s+disponibles/i.test(html)) {
    return { available: false, rows: [] };
  }
  // Decode named/numeric entities up-front so schedule headers like
  // "GUARDIAS DE D&Iacute;A" are recognisable as "GUARDIAS DE DÍA".
  html = decodeEntities(html);

  // Walk the HTML in document order picking up:
  //   - schedule block headers ("GUARDIAS ...", "DE ... MAÑANA")
  //   - purple font sections (municipality/sector)
  //   - green font entries (addresses)
  // A single regex covers all three so we preserve ordering.
  const walker = new RegExp(
    [
      // 1: schedule header text
      String.raw`GUARDIAS\s+[A-ZÁÉÍÓÚÑ ]{2,}`,
      String.raw`DE\s+\d{1,2}[:.]\d{2}\s+DE\s+HOY\s+A\s+\d{1,2}[:.]\d{2}[^<\n]*`,
      // 2: purple font (municipality/sector)  -> group 1
      String.raw`color:\s*#a352ae[^>]*>\s*([^<]+?)\s*</font>`,
      // 3: green font (address)               -> group 2
      String.raw`color:\s*#7baf0f[^>]*>\s*([^<]+?)\s*</font>`,
    ].join('|'),
    'gi'
  );

  const rows: ParsedGuardRow[] = [];
  let currentSchedule: string | null = null;
  let currentSector: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = walker.exec(html)) !== null) {
    const matched = m[0];
    const purple = m[1];
    const green = m[2];

    if (purple !== undefined) {
      currentSector = clean(purple);
      continue;
    }

    if (green !== undefined) {
      const raw = clean(green);
      if (!raw || raw.length < 4) continue;

      // Split "<ADDRESS> - <SECTOR>" (last dash usually holds sector)
      let address = raw;
      let sectorFromLine: string | null = null;
      const dashIdx = raw.lastIndexOf(' - ');
      if (dashIdx > 0) {
        address = raw.slice(0, dashIdx).trim();
        sectorFromLine = raw.slice(dashIdx + 3).trim();
      }
      if (!address) continue;

      const sector = sectorFromLine || currentSector;
      const municipality = canonicalMunicipality(
        sector || opts.zone_label || 'Málaga',
        opts.zone_label
      );

      // Synthesise a stable name; we deliberately do NOT claim opening hours
      // in the name, only the schedule label if present.
      const namePrefix = address.split(/[,(]/)[0].trim();
      const name = `Farmacia · ${namePrefix}`.slice(0, 180);

      rows.push({
        name,
        address,
        municipality,
        sector,
        duty_hours: currentSchedule,
        source_ref: opts.source_ref,
        duty_date: opts.duty_date,
      });
      continue;
    }

    // Otherwise it's a schedule block header.
    currentSchedule = clean(matched);
  }

  return { available: true, rows };
}

/**
 * Deduplicate rows across multiple zone queries. Two rows are the "same
 * guardia" if they share date + municipality + address + duty_hours.
 * Phones/names are ignored on purpose (portal never emits them consistently).
 */
export function dedupeGuardRows(rows: ParsedGuardRow[]): ParsedGuardRow[] {
  const seen = new Set<string>();
  const norm = (s: string | null) =>
    stripAccents((s ?? '').toLowerCase()).replace(/\s+/g, ' ').trim();

  const out: ParsedGuardRow[] = [];
  for (const r of rows) {
    const key = [
      r.duty_date,
      norm(r.municipality),
      norm(r.address),
      norm(r.duty_hours),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Build the exact URL the official portal uses for a given zone+date query.
 * `date` is a JS Date interpreted as Europe/Madrid calendar day.
 * The portal expects `D/M/YYYY` (not zero-padded, day-first).
 */
export function buildOfficialUrl(zoneId: string, dateISO: string, kind: 'vzona' | 'vpoblacion' = 'vzona'): string {
  // dateISO is YYYY-MM-DD (already Madrid-anchored by the caller).
  const [y, mo, d] = dateISO.split('-').map((x) => parseInt(x, 10));
  const dateParam = `${d}/${mo}/${y}`;
  const base = 'https://farmaciasguardia.farmaceuticos.com/web_guardias/Guardias.asp';
  return `${base}?date=${dateParam}&provincia=29&${kind}=${zoneId}`;
}
