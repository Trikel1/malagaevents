-- Bloque 5: attach real adapters to Axarquía Costa del Sol and Serranía de
-- Ronda. Sierra de las Nieves stays paused because its /eventos/ page carries
-- only WordPress blog posts (no JSON-LD Event, no ICS, no structured markup)
-- and building an adapter would require inventing dates/venues. Additive &
-- reversible. Sources REMAIN disabled (enabled=false, robots_ok=false) until
-- the legal/tech gate is signed off (preflight documented in
-- docs/agenda-preflight/{axarquia-costa-del-sol,serrania-de-ronda,
-- sierra-de-las-nieves}.md).

UPDATE public.event_sources
SET adapter_key = 'axarquia-costa-del-sol',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque5] adapter=axarquia-costa-del-sol (The Events Calendar JSON-LD + safeFetch); filtra eventos fuera de provincia Málaga (region!=Málaga y CP no empieza por 29); permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-eventos-axarquia-costa-del-sol' AND adapter_key = 'pending';

UPDATE public.event_sources
SET adapter_key = 'serrania-de-ronda',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque5] adapter=serrania-de-ronda (hCalendar vevent microformat + safeFetch, listado paginado, tomamos primera página bounded=20); permanece disabled hasta firmar terms_reviewed_at.'
WHERE slug = 'src-eventos-serrania-de-ronda' AND adapter_key = 'pending';

UPDATE public.event_sources
SET paused_reason = 'no_structured_event_data:wp_blog_posts',
    notes = COALESCE(notes, '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE ' ' END ||
      '[2026-07-13 Bloque5] fuente pausada: /eventos/ es un listado de posts WordPress (categoria=actualidad) sin JSON-LD Event, sin ICS, sin microformato; construir adapter exigiría inventar fecha/lugar. Reevaluar cuando se publique agenda estructurada.'
WHERE slug = 'src-eventos-sierra-de-las-nieves' AND adapter_key = 'pending';