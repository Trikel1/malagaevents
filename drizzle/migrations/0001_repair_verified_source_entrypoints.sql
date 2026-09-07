-- Narrow entrypoint repair for two sources whose replacement URL was verified
-- by HTTP on 2026-09-07. Enabled/active state and all other metadata untouched.
UPDATE public.event_sources
SET base_url = 'https://www.uma.es/contenedorcultural/'
WHERE slug = 'contenedor-uma'
  AND base_url = 'https://www.uma.es/servicio-cultura/info/111568/contenedor-cultural/';

UPDATE public.sources_config
SET chosen_entrypoint = 'https://teatrodelsoho.com/programacion/?temporada=temporada-2026-2027',
    updated_at = now()
WHERE slug = 'teatro-soho'
  AND chosen_entrypoint = 'https://teatrodelsoho.com/programacion/?temporada=temporada-2025-2026';