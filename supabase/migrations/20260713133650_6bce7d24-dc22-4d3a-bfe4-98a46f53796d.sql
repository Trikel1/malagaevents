-- Bloque 3: attach real adapters to Diputación provincial and Culturama.
-- Additive & reversible. Sources REMAIN disabled (enabled=false, robots_ok=false)
-- until legal/tech gate is signed off (preflight documented in
-- docs/agenda-preflight/{diputacion-malaga,culturama}.md).
UPDATE public.event_sources
SET adapter_key = 'diputacion-malaga',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque3] adapter=diputacion-malaga vía Firecrawl; permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-agenda-provincial' AND adapter_key = 'pending';

UPDATE public.event_sources
SET adapter_key = 'culturama',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque3] adapter=culturama vía Firecrawl; permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-culturama-agenda' AND adapter_key = 'pending';