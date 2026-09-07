-- Trazabilidad de imágenes retiradas: nunca se pierde el valor original.
CREATE TABLE IF NOT EXISTS public.event_image_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  reason text NOT NULL,
  shared_with integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_image_quarantine TO authenticated;
GRANT ALL ON public.event_image_quarantine TO service_role;

ALTER TABLE public.event_image_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read image quarantine" ON public.event_image_quarantine;
CREATE POLICY "Admins can read image quarantine"
ON public.event_image_quarantine
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Imágenes compartidas por 3 o más eventos DISTINTOS (carteles genéricos de
-- agenda, cabeceras de sección): no representan el evento concreto.
WITH generic_urls AS (
  SELECT image_url
  FROM public.events
  WHERE image_url IS NOT NULL
  GROUP BY image_url
  HAVING count(DISTINCT lower(regexp_replace(title, '\s*\(Edici[oó]n[^)]*\)', '', 'gi'))) >= 3
), affected AS (
  SELECT e.id, e.image_url, (SELECT count(*) FROM public.events x WHERE x.image_url = e.image_url) AS shared_with
  FROM public.events e
  JOIN generic_urls g ON g.image_url = e.image_url
)
INSERT INTO public.event_image_quarantine (event_id, image_url, reason, shared_with)
SELECT id, image_url, 'shared_generic_image', shared_with FROM affected;

UPDATE public.events e
SET image_url = NULL
FROM public.event_image_quarantine q
WHERE q.event_id = e.id
  AND q.reason = 'shared_generic_image'
  AND e.image_url = q.image_url;