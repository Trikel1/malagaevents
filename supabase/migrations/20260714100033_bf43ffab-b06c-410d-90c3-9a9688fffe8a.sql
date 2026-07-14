
-- Fase 2: completar cobertura oficial de 103 municipios en `locations` y aliases.
-- Aditivo e idempotente. No modifica filas existentes.

INSERT INTO public.locations (name, normalized_name, province, country, is_in_province_malaga, is_enabled, needs_review)
VALUES
  ('Almargen', 'almargen', 'Málaga', 'España', true, true, false),
  ('Almogía', 'almogia', 'Málaga', 'España', true, true, false),
  ('Arenas', 'arenas', 'Málaga', 'España', true, true, false),
  ('Benamargosa', 'benamargosa', 'Málaga', 'España', true, true, false),
  ('Benarrabá', 'benarraba', 'Málaga', 'España', true, true, false),
  ('Cuevas Bajas', 'cuevas-bajas', 'Málaga', 'España', true, true, false),
  ('Cuevas de San Marcos', 'cuevas-de-san-marcos', 'Málaga', 'España', true, true, false),
  ('Cútar', 'cutar', 'Málaga', 'España', true, true, false),
  ('Montecorto', 'montecorto', 'Málaga', 'España', true, true, false),
  ('Serrato', 'serrato', 'Málaga', 'España', true, true, false),
  ('Valle de Abdalajís', 'valle-de-abdalajis', 'Málaga', 'España', true, true, false),
  ('Viñuela', 'vinuela', 'Málaga', 'España', true, true, false)
ON CONFLICT (normalized_name) DO NOTHING;

-- Aliases (slug canónico + variante acentuada) apuntando a los `municipalities` existentes.
INSERT INTO public.municipality_aliases (municipality_id, alias, alias_normalized, alias_type)
SELECT m.id, a.alias, a.alias_norm, 'canonical'
FROM (VALUES
  ('almargen',              'Almargen',             'almargen'),
  ('almogia',               'Almogía',              'almogia'),
  ('almogia',               'Almogia',              'almogia-nofd'),
  ('arenas',                'Arenas',               'arenas'),
  ('benamargosa',           'Benamargosa',          'benamargosa'),
  ('benarraba',             'Benarrabá',            'benarraba'),
  ('benarraba',             'Benarraba',            'benarraba-nofd'),
  ('cuevas-bajas',          'Cuevas Bajas',         'cuevas-bajas'),
  ('cuevas-de-san-marcos',  'Cuevas de San Marcos', 'cuevas-de-san-marcos'),
  ('cutar',                 'Cútar',                'cutar'),
  ('cutar',                 'Cutar',                'cutar-nofd'),
  ('montecorto',            'Montecorto',           'montecorto'),
  ('serrato',               'Serrato',              'serrato'),
  ('valle-de-abdalajis',    'Valle de Abdalajís',   'valle-de-abdalajis'),
  ('valle-de-abdalajis',    'Valle de Abdalajis',   'valle-de-abdalajis-nofd'),
  ('vinuela',               'Viñuela',              'vinuela'),
  ('vinuela',               'Vinuela',              'vinuela-nofd')
) AS a(slug, alias, alias_norm)
JOIN public.municipalities m ON m.slug = a.slug
ON CONFLICT (alias_normalized) DO NOTHING;
