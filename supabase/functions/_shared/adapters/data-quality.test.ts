// H1 data-quality harness — read-only, deterministic.
//
// Runs the validator against synthetic CanonicalEvent[] fixtures that mimic
// the exact failure modes we've seen (midnight-UTC, endAt<startAt, absurd
// range, social ticketUrl, etc.) plus one "good" event.
//
// This test does NOT run adapters live. It guarantees the validator
// itself works and documents the invariants an adapter must respect.
// Adapter-specific dry-run harnesses call validateEvents() on their real
// output as a soft/hard gate.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { CanonicalEvent } from "../ingestion/types.ts";
import { validateEvents, formatReport } from "./lib/data-quality.ts";

function mkEvent(over: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    title: "Test event",
    description: null,
    startAt: "2026-08-15T18:00:00.000Z", // 20:00 Europe/Madrid summer
    endAt: null,
    timezone: "Europe/Madrid",
    venueName: "La Térmica",
    locality: "Málaga",
    category: "other",
    imageUrl: null,
    sourceUrl: "https://www.latermicamalaga.com/evento-x/",
    ticketUrl: null,
    priceText: null,
    raw: { adapter: "test" },
    ...over,
  };
}

Deno.test("data-quality: passes on a well-formed event", () => {
  const r = validateEvents("fixture-good", [mkEvent({})]);
  console.log(formatReport(r));
  assertEquals(r.errors.length, 0, "well-formed event must have no errors");
});

Deno.test("data-quality: flags midnight-UTC without assumed flag as ERROR", () => {
  const r = validateEvents("fixture-midnight", [
    mkEvent({ startAt: "2026-11-05T00:00:00.000Z" }),
  ]);
  console.log(formatReport(r));
  assert(
    r.errors.some((e) => e.code === "midnight_utc_without_assumed_flag"),
    "must flag midnight-UTC as error",
  );
});

Deno.test("data-quality: midnight-UTC with timeAssumed=true is still ERROR (bad hour)", () => {
  // Any adapter using 00:00 UTC even with timeAssumed=true is wrong; correct
  // fallback is 20:00 local (18:00 UTC summer / 19:00 UTC winter).
  const r = validateEvents("fixture-midnight-assumed", [
    mkEvent({
      startAt: "2026-11-05T00:00:00.000Z",
      raw: { timeAssumed: true },
    }),
  ]);
  console.log(formatReport(r));
  assert(
    r.errors.some((e) => e.code === "assumed_time_at_bad_hour"),
    "assumed time at bad hour must be error",
  );
});

Deno.test("data-quality: rejects endAt before startAt", () => {
  const r = validateEvents("fixture-badrange", [
    mkEvent({
      startAt: "2026-08-15T18:00:00.000Z",
      endAt: "2026-08-14T18:00:00.000Z",
    }),
  ]);
  console.log(formatReport(r));
  assert(r.errors.some((e) => e.code === "endAt_before_startAt"));
});

Deno.test("data-quality: long range without exhibition flag is ERROR", () => {
  const r = validateEvents("fixture-longrange", [
    mkEvent({
      startAt: "2026-01-01T18:00:00.000Z",
      endAt: "2027-06-01T18:00:00.000Z",
    }),
  ]);
  console.log(formatReport(r));
  assert(r.errors.some((e) => e.code === "long_range_without_exhibition_flag"));
});

Deno.test("data-quality: long range WITH exhibition flag is OK", () => {
  const r = validateEvents("fixture-exhibition", [
    mkEvent({
      startAt: "2026-01-01T18:00:00.000Z",
      endAt: "2027-06-01T18:00:00.000Z",
      raw: { isExhibition: true },
    }),
  ]);
  console.log(formatReport(r));
  assertEquals(r.errors.length, 0);
});

Deno.test("data-quality: rejects social ticketUrl and non-absolute URLs", () => {
  const r = validateEvents("fixture-badurls", [
    mkEvent({ ticketUrl: "https://instagram.com/latermica" }),
    mkEvent({ sourceUrl: "/evento-relativo/" }),
    mkEvent({ imageUrl: "//img.example.com/x.jpg" }),
  ]);
  console.log(formatReport(r));
  assert(r.errors.some((e) => e.code === "ticketUrl_social"));
  assert(r.errors.some((e) => e.code === "sourceUrl_not_absolute"));
  assert(r.errors.some((e) => e.code === "imageUrl_not_absolute"));
});

Deno.test("data-quality: reports duplicates as warnings", () => {
  const r = validateEvents("fixture-dupes", [
    mkEvent({ sourceUrl: "https://x.com/a" }),
    mkEvent({ sourceUrl: "https://x.com/a" }),
  ]);
  console.log(formatReport(r));
  assert(r.warnings.some((w) => w.code === "duplicate_sourceUrl"));
});

Deno.test("data-quality: winter 20:00 fallback (19:00 UTC) is accepted", () => {
  // 19:00 UTC in November = 20:00 Europe/Madrid winter — the correct fallback shape
  const r = validateEvents("fixture-winter-fallback", [
    mkEvent({
      startAt: "2026-11-05T19:00:00.000Z",
      raw: { timeAssumed: true, timeSource: "fallback" },
    }),
  ]);
  console.log(formatReport(r));
  assertEquals(r.errors.length, 0, "20:00 local winter fallback must pass");
});
