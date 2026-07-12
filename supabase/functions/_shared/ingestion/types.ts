// Shared types for the modular ingestion engine (Phase 2A).
// This module DOES NOT touch sync-events, sync-sports or scrape-pharmacies.

export type CanonicalEvent = {
  title: string;
  description?: string | null;
  startAt: string; // ISO 8601 with timezone offset (Europe/Madrid)
  endAt?: string | null;
  timezone: "Europe/Madrid";
  venueName?: string | null;
  venueAddress?: string | null;
  locality: string;
  category?: string | null;
  imageUrl?: string | null;
  sourceUrl: string;
  ticketUrl?: string | null;
  priceText?: string | null;
  raw?: unknown;
};

export type EventSourceRow = {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  base_url: string | null;
  adapter_key: string | null;
  locality_slug: string | null;
  category_hints: string[] | null;
  priority: number | null;
  enabled: boolean;
  schedule_cron: string | null;
  robots_ok: boolean;
  notes: string | null;
};

export type RunStatus = "running" | "success" | "partial" | "error";

export type RunSummary = {
  runId: string;
  sourceId: string;
  status: RunStatus;
  inserted: number;
  updated: number;
  skippedDupes: number;
  errors: number;
  durationMs: number;
  dryRun: boolean;
  preview?: CanonicalEvent[];
};

export type AdapterContext = {
  source: EventSourceRow;
  dryRun: boolean;
  logger: {
    info: (msg: string, extra?: Record<string, unknown>) => void;
    warn: (msg: string, extra?: Record<string, unknown>) => void;
    error: (msg: string, extra?: Record<string, unknown>) => void;
  };
};

export type SourceAdapter = {
  key: string;
  name: string;
  fetchEvents: (ctx: AdapterContext) => Promise<CanonicalEvent[]>;
};

export type IngestionStage =
  | "auth"
  | "load_source"
  | "fetch"
  | "parse"
  | "normalize"
  | "dedupe"
  | "upsert"
  | "finalize";
