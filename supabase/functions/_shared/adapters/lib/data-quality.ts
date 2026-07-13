// Data-quality validator for CanonicalEvent[] arrays.
//
// SAFETY & SCOPE:
//  - Read-only. Pure functions. No DB. No writes.
//  - Used by adapter tests to verify that events emitted in dry-run
//    are shaped correctly BEFORE any future write path is enabled.
//
// The validator distinguishes:
//   - ERRORS:   a CanonicalEvent an adapter emits that is clearly invalid
//               (missing required fields, endAt < startAt, invalid dates,
//               midnight-UTC startAt without explicit timeAssumed metadata,
//               absurd year, non-absolute URL, ticket points to social).
//   - WARNINGS: soft-quality issues (local hour in 0-6 with timeAssumed=true,
//               duplicated sourceUrl, unknown category, missing image, etc).
//
// Adapters may still return [] — that is not an error, just a warning.

import type { CanonicalEvent } from "../../ingestion/types.ts";

export type QualityIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  eventIndex?: number;
  sourceUrl?: string;
};

export type QualityReport = {
  adapter: string;
  total: number;
  errors: QualityIssue[];
  warnings: QualityIssue[];
  stats: {
    midnightUtc: number;
    localHourSuspicious: number;
    timeAssumed: number;
    withEndAt: number;
    withTicket: number;
    withImage: number;
    longRanges: number;
    exhibitions: number;
    duplicateSourceUrls: number;
    duplicateApproxKeys: number;
  };
};

const KNOWN_CATEGORIES = new Set([
  "music", "theater", "kids", "family", "arts", "cinema",
  "sports", "food", "market", "festival", "conference",
  "workshop", "exhibition", "other",
]);

const SOCIAL_HOSTS =
  /^(https?:\/\/)?(www\.)?(instagram\.com|facebook\.com|fb\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be)/i;

function isAbsoluteHttpUrl(u: string | null | undefined): boolean {
  return !!u && /^https?:\/\//i.test(u);
}

/**
 * A date is "midnight UTC" if its ISO representation is exactly YYYY-MM-DDT00:00:00.000Z.
 * That is the exact shape produced by "date-only" ingestion — the bug the UI mitigates.
 */
function isMidnightUtc(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

function localHourMadrid(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  const h = parseInt(s, 10);
  return Number.isFinite(h) ? h : null;
}

export function validateEvents(
  adapterKey: string,
  events: CanonicalEvent[],
): QualityReport {
  const errors: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const stats = {
    midnightUtc: 0,
    localHourSuspicious: 0,
    timeAssumed: 0,
    withEndAt: 0,
    withTicket: 0,
    withImage: 0,
    longRanges: 0,
    exhibitions: 0,
    duplicateSourceUrls: 0,
    duplicateApproxKeys: 0,
  };

  const seenUrls = new Map<string, number>();
  const seenApproxKeys = new Map<string, number>();
  const now = Date.now();

  events.forEach((ev, i) => {
    const push = (level: "error" | "warning", code: string, message: string) => {
      (level === "error" ? errors : warnings).push({
        level, code, message, eventIndex: i, sourceUrl: ev.sourceUrl,
      });
    };

    // Required fields
    if (!ev.title || !ev.title.trim()) push("error", "missing_title", "title is empty");
    if (!ev.startAt) push("error", "missing_startAt", "startAt is empty");
    if (!ev.locality || !ev.locality.trim()) push("error", "missing_locality", "locality is empty");
    if (!ev.venueName || !ev.venueName.trim()) push("warning", "missing_venue", "venueName is empty");
    if (!ev.sourceUrl) {
      push("error", "missing_sourceUrl", "sourceUrl is empty");
    } else if (!isAbsoluteHttpUrl(ev.sourceUrl)) {
      push("error", "sourceUrl_not_absolute", `sourceUrl not absolute: ${ev.sourceUrl}`);
    }

    // Timezone
    if (ev.timezone !== "Europe/Madrid") {
      push("error", "wrong_timezone", `timezone=${ev.timezone}, expected Europe/Madrid`);
    }

    // Date validity
    if (ev.startAt) {
      const start = new Date(ev.startAt);
      if (Number.isNaN(start.getTime())) {
        push("error", "invalid_startAt", `startAt is not a valid date: ${ev.startAt}`);
      } else {
        const yr = start.getUTCFullYear();
        if (yr < 2020 || yr > 2035) {
          push("error", "unreasonable_year", `startAt year ${yr} outside 2020-2035`);
        }
        if (isMidnightUtc(ev.startAt)) {
          stats.midnightUtc++;
          const raw = (ev.raw ?? {}) as Record<string, unknown>;
          if (raw.timeAssumed !== true) {
            push(
              "error",
              "midnight_utc_without_assumed_flag",
              "startAt is exactly 00:00 UTC (produces 01:00/02:00 local); adapter must use 20:00 Europe/Madrid fallback with raw.timeAssumed=true instead",
            );
          }
        }
        const lh = localHourMadrid(ev.startAt);
        if (lh !== null && lh >= 0 && lh <= 6) {
          stats.localHourSuspicious++;
          const raw = (ev.raw ?? {}) as Record<string, unknown>;
          if (raw.timeAssumed === true) {
            push(
              "error",
              "assumed_time_at_bad_hour",
              `raw.timeAssumed=true but local hour is ${lh}:00 — fallback must be 20:00 local, not this`,
            );
          } else {
            push(
              "warning",
              "suspicious_local_hour",
              `event starts at ${lh}:00 Europe/Madrid — verify source`,
            );
          }
        }

        // End validation
        if (ev.endAt) {
          stats.withEndAt++;
          const end = new Date(ev.endAt);
          if (Number.isNaN(end.getTime())) {
            push("error", "invalid_endAt", `endAt is not a valid date: ${ev.endAt}`);
          } else if (end.getTime() < start.getTime()) {
            push("error", "endAt_before_startAt", "endAt precedes startAt");
          } else {
            const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
            const raw = (ev.raw ?? {}) as Record<string, unknown>;
            const isExhibition = raw.isExhibition === true;
            if (isExhibition) stats.exhibitions++;
            if (spanDays > 180) {
              stats.longRanges++;
              if (!isExhibition) {
                push(
                  "error",
                  "long_range_without_exhibition_flag",
                  `range spans ${Math.round(spanDays)} days — requires raw.isExhibition=true`,
                );
              }
            }
          }
        }

        // Past events warning (>1 day old)
        if (start.getTime() < now - 86_400_000) {
          push("warning", "past_event", "event is in the past");
        }
      }
    }

    // Raw flags
    const raw = (ev.raw ?? {}) as Record<string, unknown>;
    if (raw.timeAssumed === true) stats.timeAssumed++;

    // Ticket URL
    if (ev.ticketUrl) {
      stats.withTicket++;
      if (!isAbsoluteHttpUrl(ev.ticketUrl)) {
        push("error", "ticketUrl_not_absolute", `ticketUrl not absolute: ${ev.ticketUrl}`);
      } else if (SOCIAL_HOSTS.test(ev.ticketUrl)) {
        push("error", "ticketUrl_social", `ticketUrl points to social network: ${ev.ticketUrl}`);
      }
    }

    // Image URL
    if (ev.imageUrl) {
      stats.withImage++;
      if (!isAbsoluteHttpUrl(ev.imageUrl)) {
        push("error", "imageUrl_not_absolute", `imageUrl not absolute: ${ev.imageUrl}`);
      }
    }

    // Category
    if (ev.category && !KNOWN_CATEGORIES.has(ev.category)) {
      push("warning", "unknown_category", `category="${ev.category}" not in known set`);
    }

    // HTML in raw fields
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && /<[a-z][^>]*>/i.test(v)) {
        push("warning", "html_in_raw", `raw.${k} contains HTML tags`);
        break;
      }
    }

    // Dedupe tracking
    if (ev.sourceUrl) {
      seenUrls.set(ev.sourceUrl, (seenUrls.get(ev.sourceUrl) ?? 0) + 1);
    }
    if (ev.title && ev.startAt) {
      const approx = `${ev.title.trim().toLowerCase()}|${(ev.venueName ?? "").toLowerCase()}|${ev.startAt.slice(0, 13)}`;
      seenApproxKeys.set(approx, (seenApproxKeys.get(approx) ?? 0) + 1);
    }
  });

  for (const [url, n] of seenUrls) {
    if (n > 1) {
      stats.duplicateSourceUrls += n - 1;
      warnings.push({
        level: "warning",
        code: "duplicate_sourceUrl",
        message: `sourceUrl repeated ${n}×: ${url}`,
      });
    }
  }
  for (const [k, n] of seenApproxKeys) {
    if (n > 1) {
      stats.duplicateApproxKeys += n - 1;
      warnings.push({
        level: "warning",
        code: "duplicate_approx_key",
        message: `title+venue+hour repeated ${n}×: ${k}`,
      });
    }
  }

  return { adapter: adapterKey, total: events.length, errors, warnings, stats };
}

export function formatReport(r: QualityReport): string {
  const lines: string[] = [];
  lines.push(`\n[data-quality] adapter=${r.adapter} total=${r.total}`);
  lines.push(`  stats: ${JSON.stringify(r.stats)}`);
  if (r.errors.length) {
    lines.push(`  ERRORS (${r.errors.length}):`);
    for (const e of r.errors.slice(0, 10)) {
      lines.push(`    ✗ [${e.code}] ${e.message}`);
    }
    if (r.errors.length > 10) lines.push(`    ... +${r.errors.length - 10} more`);
  }
  if (r.warnings.length) {
    lines.push(`  warnings (${r.warnings.length}):`);
    for (const w of r.warnings.slice(0, 6)) {
      lines.push(`    · [${w.code}] ${w.message}`);
    }
    if (r.warnings.length > 6) lines.push(`    ... +${r.warnings.length - 6} more`);
  }
  return lines.join("\n");
}
