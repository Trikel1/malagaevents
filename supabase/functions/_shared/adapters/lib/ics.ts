// iCalendar (RFC 5545) parser for ingestion adapters.
//
// Scope:
// - Handles VCALENDAR containing VEVENT components. Ignores VTODO/VJOURNAL.
// - Unfolds RFC 5545 line folds (CRLF + WSP).
// - Splits `KEY;PARAMS:VALUE` correctly (quoted parameter values allowed).
// - Decodes standard escapes (\n, \N, \, , \; , \\).
// - Parses DTSTART / DTEND / DTSTAMP as either DATE (all-day) or DATE-TIME
//   (naive local, UTC 'Z', or floating with TZID param preserved).
// - Preserves raw RRULE for the caller to expand if needed.
// - Never throws on malformed values — returns partial data.

import { safeFetch, type SafeFetchOptions } from "./http.ts";

export type IcsDateKind = "date" | "date-time-utc" | "date-time-local";

export interface IcsDateTime {
  raw: string;
  kind: IcsDateKind;
  /** ISO string when parseable; null when unparseable. */
  iso: string | null;
  /** TZID parameter, if present. */
  tzid: string | null;
}

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  url: string;
  status: string;
  categories: string[];
  rrule: string | null;
  dtstart: IcsDateTime | null;
  dtend: IcsDateTime | null;
  dtstamp: IcsDateTime | null;
  lastModified: IcsDateTime | null;
  geo: { lat: number; lng: number } | null;
  /** Raw key/value bag for adapter-specific extensions (X-*). */
  raw: Record<string, string>;
}

export interface ParsedCalendar {
  prodId: string;
  version: string;
  method: string;
  events: IcsEvent[];
}

// --- line unfolding + tokenization -------------------------------------------

function unfold(text: string): string[] {
  // RFC 5545: any CRLF followed by a linear whitespace (space or tab) is a
  // continuation of the previous line.
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out.filter((l) => l.length > 0);
}

interface IcsProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Splits a content line into name, params and value. Handles quoted parameter
 * values (`KEY;X="a:b":value`) so the first unquoted colon terminates params.
 */
function parseLine(line: string): IcsProp {
  let inQuotes = false;
  let colonAt = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colonAt = i;
      break;
    }
  }
  if (colonAt === -1) {
    return { name: line.toUpperCase(), params: {}, value: "" };
  }
  const head = line.slice(0, colonAt);
  const value = line.slice(colonAt + 1);

  const parts = head.split(";");
  const name = parts.shift()!.toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).toUpperCase();
    let v = p.slice(eq + 1);
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params[k] = v;
  }
  return { name, params, value };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseDateTime(prop: IcsProp): IcsDateTime {
  const raw = prop.value;
  const tzid = prop.params["TZID"] ?? null;
  const isDate = prop.params["VALUE"] === "DATE" || /^\d{8}$/.test(raw);

  if (isDate) {
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return { raw, kind: "date", iso: null, tzid };
    return {
      raw,
      kind: "date",
      iso: `${m[1]}-${m[2]}-${m[3]}`,
      tzid,
    };
  }

  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) {
    // Unrecognized shape — still surface raw so caller can log it.
    return { raw, kind: "date-time-local", iso: null, tzid };
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${
    m[7] ? "Z" : ""
  }`;
  return {
    raw,
    kind: m[7] ? "date-time-utc" : "date-time-local",
    iso,
    tzid,
  };
}

// --- public API ---------------------------------------------------------------

export function parseIcs(text: string): ParsedCalendar {
  const lines = unfold(text);
  const out: ParsedCalendar = {
    prodId: "",
    version: "",
    method: "",
    events: [],
  };

  let inCal = false;
  let inEvent = false;
  let current: IcsEvent | null = null;

  for (const line of lines) {
    const prop = parseLine(line);
    if (prop.name === "BEGIN") {
      if (prop.value === "VCALENDAR") inCal = true;
      else if (prop.value === "VEVENT" && inCal) {
        inEvent = true;
        current = {
          uid: "",
          summary: "",
          description: "",
          location: "",
          url: "",
          status: "",
          categories: [],
          rrule: null,
          dtstart: null,
          dtend: null,
          dtstamp: null,
          lastModified: null,
          geo: null,
          raw: {},
        };
      }
      continue;
    }
    if (prop.name === "END") {
      if (prop.value === "VEVENT" && current) {
        out.events.push(current);
        current = null;
        inEvent = false;
      } else if (prop.value === "VCALENDAR") {
        inCal = false;
      }
      continue;
    }

    if (!inCal) continue;

    if (!inEvent || !current) {
      if (prop.name === "PRODID") out.prodId = prop.value;
      else if (prop.name === "VERSION") out.version = prop.value;
      else if (prop.name === "METHOD") out.method = prop.value;
      continue;
    }

    switch (prop.name) {
      case "UID":
        current.uid = prop.value;
        break;
      case "SUMMARY":
        current.summary = unescapeText(prop.value);
        break;
      case "DESCRIPTION":
        current.description = unescapeText(prop.value);
        break;
      case "LOCATION":
        current.location = unescapeText(prop.value);
        break;
      case "URL":
        current.url = prop.value;
        break;
      case "STATUS":
        current.status = prop.value;
        break;
      case "CATEGORIES":
        current.categories = prop.value
          .split(",")
          .map((s) => unescapeText(s.trim()))
          .filter(Boolean);
        break;
      case "RRULE":
        current.rrule = prop.value;
        break;
      case "DTSTART":
        current.dtstart = parseDateTime(prop);
        break;
      case "DTEND":
        current.dtend = parseDateTime(prop);
        break;
      case "DTSTAMP":
        current.dtstamp = parseDateTime(prop);
        break;
      case "LAST-MODIFIED":
        current.lastModified = parseDateTime(prop);
        break;
      case "GEO": {
        const parts = prop.value.split(/;|,/);
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          current.geo = { lat, lng };
        }
        break;
      }
      default:
        if (prop.name.startsWith("X-")) current.raw[prop.name] = prop.value;
    }
  }

  return out;
}

export async function fetchIcs(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<ParsedCalendar> {
  const res = await safeFetch(url, {
    accept: "text/calendar, application/calendar+json;q=0.5, */*;q=0.5",
    ...opts,
  });
  return parseIcs(res.body);
}
