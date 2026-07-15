
-- 1) Extend sports_sources with operational fields
ALTER TABLE public.sports_sources
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT 'Málaga',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS primary_url text,
  ADD COLUMN IF NOT EXISTS secondary_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adapter_key text,
  ADD COLUMN IF NOT EXISTS sync_frequency_minutes integer NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_status text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS robots_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS robots_allowed boolean,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill primary_url from legacy `url` where missing
UPDATE public.sports_sources
   SET primary_url = url
 WHERE primary_url IS NULL AND url IS NOT NULL;

-- Constrain source_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sports_sources_source_type_chk'
  ) THEN
    ALTER TABLE public.sports_sources
      ADD CONSTRAINT sports_sources_source_type_chk
      CHECK (source_type IN ('html','ics','rss','json'));
  END IF;
END $$;

-- Unique slug (may already exist as UNIQUE; ensure via index)
CREATE UNIQUE INDEX IF NOT EXISTS sports_sources_slug_uniq_idx
  ON public.sports_sources (slug);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_sports_sources_updated_at ON public.sports_sources;
CREATE TRIGGER trg_sports_sources_updated_at
  BEFORE UPDATE ON public.sports_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Grants + RLS tightening
GRANT SELECT ON public.sports_sources TO anon, authenticated;
GRANT ALL ON public.sports_sources TO service_role;

-- Replace open public SELECT with enabled-only
DROP POLICY IF EXISTS "Sports sources publicly readable" ON public.sports_sources;
DROP POLICY IF EXISTS "Sports sources enabled readable" ON public.sports_sources;
CREATE POLICY "Sports sources enabled readable"
  ON public.sports_sources
  FOR SELECT
  USING (enabled = true);

-- Admins can still manage (policy already exists: "Admins can manage sports sources")
-- Ensure no open write policy remains
DROP POLICY IF EXISTS "Sports sources public write" ON public.sports_sources;

-- 3) Seed the 8 MVP sources (idempotent by slug)
INSERT INTO public.sports_sources
  (slug, name, url, primary_url, secondary_urls, municipality, province,
   source_type, adapter_key, sport_category, sync_frequency_minutes, priority, enabled)
VALUES
  ('malaga-capital-deportes',
   'Málaga capital — Agenda deportiva',
   'https://deporte.malaga.eu/agenda/',
   'https://deporte.malaga.eu/agenda/',
   '[]'::jsonb,
   'Málaga', 'Málaga', 'html', 'html-generic', 'other', 120, 10, true),

  ('diputacion-malaga-deportes',
   'Diputación de Málaga — Deportes',
   'https://www.malaga.es/deportes/1321/agenda',
   'https://www.malaga.es/deportes/1321/agenda',
   '["https://www.malaga.es/deportes/1322/programas"]'::jsonb,
   NULL, 'Málaga', 'html', 'html-generic', 'other', 360, 20, true),

  ('torremolinos-deportes',
   'Torremolinos — Agenda anual de eventos',
   'https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/',
   'https://deportes.torremolinos.es/eventos-deportivos/agenda-anual-eventos/',
   '[]'::jsonb,
   'Torremolinos', 'Málaga', 'html', 'html-generic', 'other', 360, 30, true),

  ('rincon-victoria-deportes',
   'Rincón de la Victoria — APAL Deportes',
   'https://apaldeportes.rincondelavictoria.es/eventos',
   'https://apaldeportes.rincondelavictoria.es/eventos',
   '[]'::jsonb,
   'Rincón de la Victoria', 'Málaga', 'html', 'html-generic', 'other', 360, 40, true),

  ('fuengirola-deportes',
   'Fuengirola — Concejalía de Deportes',
   'https://www.fuengirola.es/concejalia/concejalia-de-deportes/',
   'https://www.fuengirola.es/concejalia/concejalia-de-deportes/',
   '[]'::jsonb,
   'Fuengirola', 'Málaga', 'html', 'html-generic', 'other', 360, 50, true),

  ('velez-malaga-deportes',
   'Vélez-Málaga — Deportes',
   'https://deportes.velezmalaga.es/eventos',
   'https://deportes.velezmalaga.es/eventos',
   '[]'::jsonb,
   'Vélez-Málaga', 'Málaga', 'html', 'html-generic', 'other', 360, 60, true),

  ('ronda-turismo-agenda',
   'Ronda Turismo — Agenda',
   'https://info.turismoderonda.es/agenda/',
   'https://info.turismoderonda.es/agenda/',
   '[]'::jsonb,
   'Ronda', 'Málaga', 'html', 'html-generic', 'other', 360, 70, true),

  ('unicaja-baloncesto',
   'Unicaja Baloncesto — Calendario',
   'https://www.unicajabaloncesto.com/calendario',
   'https://www.unicajabaloncesto.com/calendario',
   '["https://www.unicajabaloncesto.com/en/schedule"]'::jsonb,
   'Málaga', 'Málaga', 'html', 'html-generic', 'basketball', 120, 5, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  primary_url = EXCLUDED.primary_url,
  secondary_urls = EXCLUDED.secondary_urls,
  municipality = EXCLUDED.municipality,
  province = EXCLUDED.province,
  source_type = EXCLUDED.source_type,
  adapter_key = EXCLUDED.adapter_key,
  sport_category = EXCLUDED.sport_category,
  sync_frequency_minutes = EXCLUDED.sync_frequency_minutes,
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 4) Sync runs: ensure source_id linkage for structured logging (nullable, backward compatible)
ALTER TABLE public.sports_sync_runs
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.sports_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adapter text;

CREATE INDEX IF NOT EXISTS sports_sync_runs_source_id_idx
  ON public.sports_sync_runs(source_id);
CREATE INDEX IF NOT EXISTS sports_sync_runs_started_at_idx
  ON public.sports_sync_runs(started_at DESC);
