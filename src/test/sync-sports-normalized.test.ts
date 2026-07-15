import { describe, it, expect } from "vitest";
import {
  computeFingerprint,
  computePayloadHash,
  normalizeText,
} from "../../supabase/functions/_shared/sports-sync/fingerprint";
import { decideUpsert, decideDeactivations } from "../../supabase/functions/_shared/sports-sync/upsert";
import { parseJsonFeed } from "../../supabase/functions/_shared/sports-sync/adapters/json";
import type { CanonicalSportsEvent } from "../../supabase/functions/_shared/sports-sync/types";

function base(overrides: Partial<CanonicalSportsEvent> = {}): CanonicalSportsEvent {
  return {
    source_name: "Torremolinos Deportes",
    source_url: "https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/",
    external_id: "torremolinos-2026-01-31-carrera-popular-5k",
    canonical_url: null,
    title: "Carrera Popular 5K",
    sport_category: "running",
    sport_subcategory: "5k",
    starts_at: "2026-01-31T09:30:00+01:00",
    ends_at: null,
    timezone: "Europe/Madrid",
    municipality: "Torremolinos",
    venue_name: "Villa Deportiva / salida urbana",
    address: "Torremolinos, Málaga",
    status: "confirmed",
    ...overrides,
  };
}

describe("normalizeText", () => {
  it("strips accents, lowercases and collapses whitespace", () => {
    expect(normalizeText("  Carrera  Popular Málaga  ")).toBe("carrera popular malaga");
    expect(normalizeText("Ñoño ¡5K!")).toBe("nono 5k");
    expect(normalizeText(null)).toBe("");
  });
});

describe("computeFingerprint", () => {
  it("is stable for same semantic inputs even with cosmetic diffs", () => {
    const a = computeFingerprint({
      title: "Carrera Popular 5K",
      starts_at: "2026-01-31T09:30:00+01:00",
      municipality: "Torremolinos",
      venue_name: "Villa Deportiva",
    });
    const b = computeFingerprint({
      title: "  CARRERA popular 5k ",
      starts_at: "2026-01-31T09:30:15+01:00", // second-level diff — truncated to minute
      municipality: "torremolinos",
      venue_name: "villa deportiva",
    });
    expect(a).toBe(b);
  });

  it("differs when start time changes at minute granularity", () => {
    const a = computeFingerprint({
      title: "X", starts_at: "2026-01-31T09:30:00+01:00", municipality: "M", venue_name: "V",
    });
    const b = computeFingerprint({
      title: "X", starts_at: "2026-01-31T10:30:00+01:00", municipality: "M", venue_name: "V",
    });
    expect(a).not.toBe(b);
  });
});

describe("computePayloadHash", () => {
  it("returns same hash for identical semantic payload", async () => {
    const a = await computePayloadHash(base());
    const b = await computePayloadHash(base());
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });
  it("changes when a semantic field changes", async () => {
    const a = await computePayloadHash(base());
    const b = await computePayloadHash(base({ title: "Carrera Popular 10K" }));
    expect(a).not.toBe(b);
  });
});

describe("decideUpsert", () => {
  it("returns insert when nothing exists", async () => {
    const d = await decideUpsert(base(), null);
    expect(d.action).toBe("insert");
  });
  it("returns unchanged when hash matches and status is active", async () => {
    const ev = base();
    const hash = await computePayloadHash(ev);
    const d = await decideUpsert(ev, {
      id: "abc", raw_payload_hash: hash, missed_syncs: 0, status: "confirmed",
    });
    expect(d.action).toBe("unchanged");
  });
  it("returns update when hash differs", async () => {
    const d = await decideUpsert(base(), {
      id: "abc", raw_payload_hash: "sha256:stale", missed_syncs: 0, status: "confirmed",
    });
    expect(d.action).toBe("update");
  });
  it("returns update to resurrect a previously cancelled event", async () => {
    const ev = base();
    const hash = await computePayloadHash(ev);
    const d = await decideUpsert(ev, {
      id: "abc", raw_payload_hash: hash, missed_syncs: 3, status: "cancelled_or_unpublished",
    });
    expect(d.action).toBe("update");
  });
});

describe("decideDeactivations (JSON threshold=3)", () => {
  it("bumps missed_syncs but doesn't cancel until threshold", () => {
    const decisions = decideDeactivations(
      new Set(["ext:seen"]),
      [
        { id: "1", key: "ext:missing", missed_syncs: 0, status: "confirmed" },
        { id: "2", key: "ext:missing2", missed_syncs: 1, status: "confirmed" },
      ],
      3,
      "cancelled_or_unpublished",
    );
    expect(decisions).toHaveLength(2);
    expect(decisions[0].nextStatus).toBe("confirmed");
    expect(decisions[0].nextMissed).toBe(1);
    expect(decisions[1].nextStatus).toBe("confirmed");
    expect(decisions[1].nextMissed).toBe(2);
  });
  it("marks cancelled_or_unpublished on third consecutive miss", () => {
    const decisions = decideDeactivations(
      new Set(),
      [{ id: "1", key: "ext:missing", missed_syncs: 2, status: "confirmed" }],
      3,
      "cancelled_or_unpublished",
    );
    expect(decisions[0].nextMissed).toBe(3);
    expect(decisions[0].nextStatus).toBe("cancelled_or_unpublished");
  });
  it("ignores rows still seen in this run", () => {
    const decisions = decideDeactivations(
      new Set(["ext:a", "fp:b"]),
      [
        { id: "1", key: "ext:a", missed_syncs: 0, status: "confirmed" },
        { id: "2", key: "fp:b", missed_syncs: 1, status: "confirmed" },
      ],
      3,
      "cancelled_or_unpublished",
    );
    expect(decisions).toHaveLength(0);
  });
});

describe("decideDeactivations (ICS threshold=2)", () => {
  it("marks missing_from_feed on second miss", () => {
    const decisions = decideDeactivations(
      new Set(),
      [{ id: "1", key: "ext:x", missed_syncs: 1, status: "confirmed" }],
      2,
      "missing_from_feed",
    );
    expect(decisions[0].nextMissed).toBe(2);
    expect(decisions[0].nextStatus).toBe("missing_from_feed");
  });
});

describe("parseJsonFeed", () => {
  it("accepts the documented payload shape", () => {
    const payload = [{
      source_name: "Torremolinos Deportes",
      source_url: "https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/",
      external_id: "torremolinos-2026-01-31-carrera-popular-5k",
      canonical_url: "https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/",
      title: "Carrera Popular 5K",
      description: "Prueba popular",
      sport_category: "running",
      sport_subcategory: "5k",
      starts_at: "2026-01-31T09:30:00+01:00",
      ends_at: null,
      timezone: "Europe/Madrid",
      municipality: "Torremolinos",
      province: "Málaga",
      venue_name: "Villa Deportiva / salida urbana",
      address: "Torremolinos, Málaga",
      lat: null, lng: null,
      price_amount: null, price_currency: "EUR",
      registration_url: "https://pruebaspopulares.pmdt.es/",
      organizer_name: "Delegación de Deportes",
      status: "confirmed",
      image_url: null,
      last_seen_at: "2026-07-15T08:00:00+02:00",
    }];
    const events = parseJsonFeed(payload, "fallback");
    expect(events).toHaveLength(1);
    expect(events[0].external_id).toBe("torremolinos-2026-01-31-carrera-popular-5k");
    expect(events[0].source_name).toBe("Torremolinos Deportes");
    expect(events[0].status).toBe("confirmed");
  });

  it("rejects items missing required fields", () => {
    expect(parseJsonFeed([{ title: "X" }], "s")).toHaveLength(0);
    expect(parseJsonFeed([{
      title: "X", starts_at: "not-a-date", municipality: "M",
      venue_name: "V", sport_category: "c",
    }], "s")).toHaveLength(0);
  });

  it("defaults unknown status to confirmed", () => {
    const events = parseJsonFeed([{
      title: "X", starts_at: "2026-01-31T09:00:00+01:00", municipality: "M",
      venue_name: "V", sport_category: "running", status: "totally-invalid",
    }], "s");
    expect(events[0].status).toBe("confirmed");
  });
});
