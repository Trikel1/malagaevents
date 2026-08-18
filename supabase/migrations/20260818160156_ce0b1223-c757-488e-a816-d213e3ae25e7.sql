-- 1. Close stale runs (>30 min, never finished). No events touched.
UPDATE public.sports_sync_runs
SET status = 'stale_cancelled',
    finished_at = now(),
    error_sample = COALESCE(error_sample, 'auto-cancelled: run exceeded 30 min without finishing')
WHERE status = 'running' AND finished_at IS NULL
  AND started_at < now() - interval '30 minutes';

-- 2. Disable objectively dead domains (DNS NXDOMAIN verified from runtime).
UPDATE public.sports_sources
SET enabled = false,
    is_active = false,
    last_status = 'disabled_dns_dead',
    last_error = 'Dominio sin DNS (NXDOMAIN) verificado 2026-08-18. Alternativa oficial: https://www.fam.es/calendario-de-pruebas/',
    updated_at = now()
WHERE slug = 'atletismo-malaga';

UPDATE public.sports_sources
SET enabled = false,
    is_active = false,
    last_status = 'disabled_dns_dead',
    last_error = 'Dominio sin DNS (NXDOMAIN) verificado 2026-08-18. Alternativa oficial: https://www.triatlonandalucia.org/',
    updated_at = now()
WHERE slug = 'triatlon-malaga';

-- 3. URL health table
CREATE TABLE IF NOT EXISTS public.url_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table text NOT NULL,
  entity_id uuid,
  field_name text NOT NULL,
  url text NOT NULL,
  url_hash text GENERATED ALWAYS AS (md5(url)) STORED,
  http_status integer,
  latency_ms integer,
  robots_allowed boolean,
  ok boolean NOT NULL DEFAULT false,
  error text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS url_health_checks_unique
  ON public.url_health_checks (entity_table, field_name, url_hash);
CREATE INDEX IF NOT EXISTS url_health_checks_entity_idx
  ON public.url_health_checks (entity_table, entity_id);

GRANT SELECT ON public.url_health_checks TO anon;
GRANT SELECT ON public.url_health_checks TO authenticated;
GRANT ALL ON public.url_health_checks TO service_role;

ALTER TABLE public.url_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "URL health is publicly readable" ON public.url_health_checks;
CREATE POLICY "URL health is publicly readable"
  ON public.url_health_checks FOR SELECT
  USING (true);