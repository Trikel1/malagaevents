-- Phase 3 consolidation: link duplicated CSV source entries to the canonical
-- `malaga-open-data-csv` adapter and ensure only the canonical one stays enabled.
-- Idempotent: safe to re-run.
DO $$
DECLARE
  canonical_id uuid;
BEGIN
  SELECT id INTO canonical_id
  FROM public.event_sources
  WHERE slug = 'malaga-open-data-csv'
  LIMIT 1;

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'malaga-open-data-csv not found — skipping consolidation.';
    RETURN;
  END IF;

  UPDATE public.event_sources
  SET canonical_source_id = canonical_id,
      enabled = false,
      notes = coalesce(notes, '') ||
              CASE WHEN notes IS NULL OR position('[phase3-consolidation]' IN notes) = 0
                   THEN E'\n[phase3-consolidation ' || to_char(now(), 'YYYY-MM-DD') ||
                        '] Duplicado de la fuente canónica malaga-open-data-csv (Agenda 2026 Datos Abiertos, CC BY 4.0). Se mantiene deshabilitado.'
                   ELSE '' END
  WHERE slug IN ('ayto-malaga-csv', 'src-datos-abiertos-agenda-2026-csv', 'src-csv-directo-agenda-2026')
    AND (canonical_source_id IS DISTINCT FROM canonical_id OR enabled = true);

  UPDATE public.event_sources
  SET notes = coalesce(notes, '') ||
              CASE WHEN position('[phase3-canonical]' IN coalesce(notes, '')) = 0
                   THEN E'\n[phase3-canonical ' || to_char(now(), 'YYYY-MM-DD') ||
                        '] Fuente canónica para la Agenda 2026 oficial (datosabiertos.malaga.eu). Actualización diaria. Licencia CC BY 4.0.'
                   ELSE '' END
  WHERE id = canonical_id;
END $$;

-- Helpful view for the admin coverage matrix: exposes future-event coverage
-- per source, reusing existing tables and joining venue counts. Read-only.
DROP VIEW IF EXISTS public.event_source_coverage;
CREATE VIEW public.event_source_coverage
WITH (security_invoker = on) AS
SELECT
  s.id                       AS source_id,
  s.slug                     AS source_slug,
  s.name                     AS source_name,
  s.kind                     AS source_kind,
  s.enabled                  AS source_enabled,
  s.priority_tier,
  s.last_success_at,
  s.last_error_at,
  s.consecutive_errors,
  s.canonical_source_id,
  COUNT(e.id) FILTER (WHERE e.status = 'published' AND e.start_at > now())            AS future_events,
  MAX(e.start_at) FILTER (WHERE e.status = 'published' AND e.start_at > now())        AS next_event_at,
  COUNT(DISTINCT e.venue_name) FILTER (WHERE e.status = 'published' AND e.start_at > now())
                                                                                     AS distinct_future_venues,
  MAX(e.updated_at)                                                                  AS last_event_updated_at
FROM public.event_sources s
LEFT JOIN public.events e ON e.source_id = s.id
GROUP BY s.id;

GRANT SELECT ON public.event_source_coverage TO authenticated;
GRANT SELECT ON public.event_source_coverage TO service_role;