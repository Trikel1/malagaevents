// Deterministic dedupe helpers shared by every adapter.
// Zero Deno-specific imports so vitest can exercise this directly.

import type { CanonicalSportsEvent } from "./types.ts";

/** Lowercase, strip accents/punctuation, collapse whitespace. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate an ISO timestamp to minute precision, timezone-preserving. */
export function truncateIsoToMinute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Keep the original offset by manipulating the string directly.
  // ISO shape: YYYY-MM-DDTHH:mm:ss(.sss)?(Z|±HH:MM)
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

/**
 * Fingerprint used when a source doesn't publish a stable external_id.
 *   normalize(title) | truncMinute(starts_at) | normalize(municipality) | normalize(venue_name)
 */
export function computeFingerprint(ev: {
  title: string;
  starts_at: string;
  municipality: string;
  venue_name: string;
}): string {
  return [
    normalizeText(ev.title),
    truncateIsoToMinute(ev.starts_at),
    normalizeText(ev.municipality),
    normalizeText(ev.venue_name),
  ].join("|");
}

/** SHA-256 as lowercase hex, using Web Crypto (available in Deno and Node 20+). */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

/** Hash of the semantic payload — changes only when a source publishes a real diff. */
export async function computePayloadHash(ev: CanonicalSportsEvent): Promise<string> {
  const payload = [
    ev.title,
    ev.starts_at,
    ev.ends_at ?? "",
    ev.venue_name,
    ev.municipality,
    ev.description ?? "",
    ev.status,
    ev.registration_url ?? "",
    ev.image_url ?? "",
    ev.sport_category,
    ev.sport_subcategory ?? "",
    ev.price_amount ?? "",
    ev.price_currency ?? "",
  ].join("|");
  return "sha256:" + (await sha256Hex(payload));
}
