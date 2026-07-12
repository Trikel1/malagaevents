-- =========================================================================
-- FASE 1 — Registry unificado de fuentes + observabilidad + dedupe columns
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- -------------------------------------------------------------------------
-- 1. event_sources — registry unificado
-- -------------------------------------------------------------------------
CREATE TABLE public.event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'institutional','theater','music','museum','festival',
    'aggregator','municipal','sports','other'
  )),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  base_url text NOT NULL,
  adapter_key text NOT NULL,
  locality_slug text NOT NULL DEFAULT 'malaga',
  category_hints text[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 50,
  enabled boolean NOT NULL DEFAULT false,
  schedule_cron text,
  robots_ok boolean NOT NULL DEFAULT false,
  notes text,
  legacy_source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_sources_enabled_idx ON public.event_sources (enabled, priority DESC) WHERE enabled;
CREATE INDEX event_sources_locality_idx ON public.event_sources (locality_slug);
CREATE INDEX event_sources_kind_idx ON public.event_sources (kind);

GRANT SELECT ON public.event_sources TO authenticated;
GRANT ALL ON public.event_sources TO service_role;
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read event_sources"
  ON public.event_sources FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER event_sources_set_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 2. event_source_runs — historial de corridas
-- -------------------------------------------------------------------------
CREATE TABLE public.event_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.event_sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','success','partial','error','timeout')),
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped_dupes integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  duration_ms integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_source_runs_source_idx
  ON public.event_source_runs (source_id, started_at DESC);
CREATE INDEX event_source_runs_status_idx
  ON public.event_source_runs (status, started_at DESC);

GRANT SELECT ON public.event_source_runs TO authenticated;
GRANT ALL ON public.event_source_runs TO service_role;
ALTER TABLE public.event_source_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read event_source_runs"
  ON public.event_source_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 3. ingestion_errors — errores estructurados
-- -------------------------------------------------------------------------
CREATE TABLE public.ingestion_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.event_sources(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.event_source_runs(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN (
    'fetch','parse','normalize','dedupe','upsert','unknown'
  )),
  message text NOT NULL,
  payload_sample jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingestion_errors_source_idx
  ON public.ingestion_errors (source_id, created_at DESC);
CREATE INDEX ingestion_errors_run_idx
  ON public.ingestion_errors (run_id);

GRANT SELECT ON public.ingestion_errors TO authenticated;
GRANT ALL ON public.ingestion_errors TO service_role;
ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ingestion_errors"
  ON public.ingestion_errors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 4. venue_aliases — normalización canónica de recintos
-- -------------------------------------------------------------------------
CREATE TABLE public.venue_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  alias_normalized text GENERATED ALWAYS AS (public.normalize_text(alias)) STORED,
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  canonical_name text,
  source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX venue_aliases_normalized_uidx
  ON public.venue_aliases (alias_normalized);

GRANT SELECT ON public.venue_aliases TO authenticated;
GRANT ALL ON public.venue_aliases TO service_role;
ALTER TABLE public.venue_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read venue_aliases"
  ON public.venue_aliases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 5. locality_aliases — normalización canónica de localidades
-- -------------------------------------------------------------------------
CREATE TABLE public.locality_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  alias_normalized text GENERATED ALWAYS AS (public.normalize_text(alias)) STORED,
  municipio_slug text NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX locality_aliases_normalized_uidx
  ON public.locality_aliases (alias_normalized);
CREATE INDEX locality_aliases_slug_idx
  ON public.locality_aliases (municipio_slug);

GRANT SELECT ON public.locality_aliases TO authenticated;
GRANT ALL ON public.locality_aliases TO service_role;
ALTER TABLE public.locality_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read locality_aliases"
  ON public.locality_aliases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 6. raw_event_snapshots — copia cruda para debug/reproducibilidad
-- -------------------------------------------------------------------------
CREATE TABLE public.raw_event_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.event_sources(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.event_source_runs(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  content_hash text NOT NULL,
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raw_event_snapshots_source_idx
  ON public.raw_event_snapshots (source_id, captured_at DESC);
CREATE INDEX raw_event_snapshots_hash_idx
  ON public.raw_event_snapshots (content_hash);

GRANT ALL ON public.raw_event_snapshots TO service_role;
ALTER TABLE public.raw_event_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read raw_event_snapshots"
  ON public.raw_event_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------------------
-- 7. events — columnas nuevas (nullable, retrocompatibles)
-- -------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS events_dedupe_key_uidx
  ON public.events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_source_id_idx
  ON public.events (source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_last_seen_at_idx
  ON public.events (last_seen_at DESC)
  WHERE last_seen_at IS NOT NULL;

-- -------------------------------------------------------------------------
-- 8. backfill_events_dedupe_keys() — idempotente
-- Genera dedupe_key = sha256(normalize(title) | normalize(venue_name) | start_at ISO)
-- Solo actualiza filas sin dedupe_key. Ignora colisiones (deja NULL para revisar).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_events_dedupe_keys()
RETURNS TABLE(updated_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  computed_key text;
  updated_n integer := 0;
  skipped_n integer := 0;
BEGIN
  FOR r IN
    SELECT id, title, venue_name, start_at
    FROM public.events
    WHERE dedupe_key IS NULL
      AND title IS NOT NULL
      AND start_at IS NOT NULL
  LOOP
    computed_key := encode(
      digest(
        public.normalize_text(r.title) ||
        '|' ||
        public.normalize_text(coalesce(r.venue_name, '')) ||
        '|' ||
        to_char(r.start_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI'),
        'sha256'
      ),
      'hex'
    );

    BEGIN
      UPDATE public.events
      SET dedupe_key = computed_key
      WHERE id = r.id;
      updated_n := updated_n + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped_n := skipped_n + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT updated_n, skipped_n;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_events_dedupe_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_events_dedupe_keys() TO service_role;