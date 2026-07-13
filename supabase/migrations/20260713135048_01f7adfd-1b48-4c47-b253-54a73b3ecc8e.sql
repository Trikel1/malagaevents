-- Bloque 4: attach real adapters to Junta de Andalucía · Cultura Málaga and
-- Visit Costa del Sol. Additive & reversible. Sources REMAIN disabled
-- (enabled=false, robots_ok=false) until legal/tech gate is signed off
-- (preflight documented in docs/agenda-preflight/{junta-andalucia-cultura,visit-costa-del-sol}.md).
UPDATE public.event_sources
SET adapter_key = 'junta-andalucia-cultura',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque4] adapter=junta-andalucia-cultura (HTML+JSON-LD, safeFetch); permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-junta-agenda-malaga' AND adapter_key = 'pending';

UPDATE public.event_sources
SET adapter_key = 'visit-costa-del-sol',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque4] adapter=visit-costa-del-sol (sitemap + Firecrawl waitFor); permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-visit-costa-del-sol' AND adapter_key = 'pending';