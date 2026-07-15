-- Add sync-oriented columns to sports_events for the unified normalized sync engine.
ALTER TABLE public.sports_events
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS raw_payload_hash text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_syncs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sport_subcategory text,
  ADD COLUMN IF NOT EXISTS registration_url text,
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS organizer_phone text,
  ADD COLUMN IF NOT EXISTS organizer_email text,
  ADD COLUMN IF NOT EXISTS price_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_currency text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS fingerprint text;

-- Unique on (source_name, external_id) when external_id present (upsert path A).
CREATE UNIQUE INDEX IF NOT EXISTS sports_events_source_external_uniq
  ON public.sports_events (source_name, external_id)
  WHERE external_id IS NOT NULL AND source_name IS NOT NULL;

-- Unique on fingerprint when set (upsert path B / dedupe fallback).
CREATE UNIQUE INDEX IF NOT EXISTS sports_events_fingerprint_uniq
  ON public.sports_events (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Helpful lookup indexes for the sync engine.
CREATE INDEX IF NOT EXISTS sports_events_last_seen_at_idx
  ON public.sports_events (source_name, last_seen_at);
CREATE INDEX IF NOT EXISTS sports_events_status_idx
  ON public.sports_events (status);
