// Canonical sports event shape produced by every adapter (json, ics, html).
// Kept framework-agnostic so it can be imported from vitest (Node) too.

export type CanonicalSportsEvent = {
  source_name: string;
  source_url: string;
  external_id: string | null;
  canonical_url: string | null;
  title: string;
  description?: string | null;
  sport_category: string;
  sport_subcategory?: string | null;
  starts_at: string; // ISO 8601 with tz offset (Europe/Madrid)
  ends_at?: string | null;
  timezone: string; // e.g. "Europe/Madrid"
  municipality: string;
  province?: string | null;
  venue_name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  price_amount?: number | null;
  price_currency?: string | null;
  registration_url?: string | null;
  organizer_name?: string | null;
  organizer_phone?: string | null;
  organizer_email?: string | null;
  status: "confirmed" | "cancelled" | "postponed" | "cancelled_or_unpublished" | "missing_from_feed";
  image_url?: string | null;
  last_seen_at?: string | null;
};

export type AdapterKind = "json" | "ics" | "html";

export type AdapterResult = {
  source_name: string;
  events: CanonicalSportsEvent[];
};

export type UpsertCounters = {
  inserted: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  errors: number;
};
