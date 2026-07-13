-- Sprint G2 — reconcile adapter_key values to match code registry names.
-- Idempotent: only updates rows where the current adapter_key doesn't already match.
-- Does NOT touch enabled, robots_ok, write_confirmed_at, priority, or slug.

UPDATE public.event_sources
SET adapter_key = 'la-cochera-cabaret'
WHERE slug = 'cochera-cabaret' AND adapter_key IS DISTINCT FROM 'la-cochera-cabaret';

UPDATE public.event_sources
SET adapter_key = 'contenedor-cultural-uma'
WHERE slug = 'contenedor-uma' AND adapter_key IS DISTINCT FROM 'contenedor-cultural-uma';

UPDATE public.event_sources
SET adapter_key = 'sala-paris-15'
WHERE slug = 'paris15' AND adapter_key IS DISTINCT FROM 'sala-paris-15';