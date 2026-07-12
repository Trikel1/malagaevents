
-- 1. Columnas nullable retrocompatibles
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_family_friendly boolean,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS age_min integer,
  ADD COLUMN IF NOT EXISTS age_max integer,
  ADD COLUMN IF NOT EXISTS is_outdoor boolean;

-- CHECK seguro para audience (permite NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_audience_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_audience_check
      CHECK (audience IS NULL OR audience IN ('kids','family','teens','adults','all'));
  END IF;
END $$;

-- Índices parciales
CREATE INDEX IF NOT EXISTS events_family_friendly_idx
  ON public.events (start_at) WHERE is_family_friendly = true;
CREATE INDEX IF NOT EXISTS events_audience_idx
  ON public.events (audience) WHERE audience IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_outdoor_idx
  ON public.events (start_at) WHERE is_outdoor = true;

-- 2. Función de backfill idempotente
CREATE OR REPLACE FUNCTION public.backfill_event_family_flags()
RETURNS TABLE(
  family_marked integer,
  audience_kids integer,
  audience_family integer,
  age_filled integer,
  outdoor_marked integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
  norm_title text;
  norm_desc text;
  norm_venue text;
  norm_location text;
  norm_age text;
  haystack text;
  is_kids boolean;
  is_family boolean;
  new_family boolean;
  new_audience text;
  new_age_min integer;
  new_age_max integer;
  new_outdoor boolean;
  m text[];
  n_family integer := 0;
  n_kids integer := 0;
  n_fam_aud integer := 0;
  n_age integer := 0;
  n_outdoor integer := 0;
BEGIN
  FOR r IN
    SELECT id, title, title_normalized, description, description_full,
           category, event_type, age_restriction, venue_name, location_name_raw,
           is_family_friendly, audience, age_min, age_max, is_outdoor
    FROM public.events
    WHERE status = 'published'
  LOOP
    norm_title := coalesce(r.title_normalized, public.normalize_text(coalesce(r.title,'')));
    norm_desc := public.normalize_text(coalesce(r.description_full, r.description, ''));
    norm_venue := public.normalize_text(coalesce(r.venue_name, ''));
    norm_location := public.normalize_text(coalesce(r.location_name_raw, ''));
    norm_age := public.normalize_text(coalesce(r.age_restriction, ''));
    haystack := norm_title || ' ' || norm_desc;

    is_kids := (
      r.category = 'kids' OR r.event_type = 'kids'
      OR haystack ~ '(^|\W)(infantil|infantiles|ninos|ninas|peques|bebe|bebes|cuento|cuentacuentos|titeres|marionetas|cantajuego|cantojuego|teatro infantil|taller infantil|para ninos|navidad infantil)(\W|$)'
    );

    is_family := (
      haystack ~ '(^|\W)(familiar|familia|familias|para toda la familia|taller familiar|educativo|didactico)(\W|$)'
    );

    -- is_family_friendly: solo escribir si aún es NULL
    new_family := r.is_family_friendly;
    IF new_family IS NULL AND (is_kids OR is_family) THEN
      new_family := true;
      n_family := n_family + 1;
    END IF;

    -- audience: no sobrescribir si ya tiene valor
    new_audience := r.audience;
    IF new_audience IS NULL THEN
      IF is_kids THEN
        new_audience := 'kids';
        n_kids := n_kids + 1;
      ELSIF is_family THEN
        new_audience := 'family';
        n_fam_aud := n_fam_aud + 1;
      END IF;
    END IF;

    -- Edades: solo si aún son NULL
    new_age_min := r.age_min;
    new_age_max := r.age_max;

    IF new_age_min IS NULL AND new_age_max IS NULL THEN
      -- "de X a Y años"
      m := regexp_matches(coalesce(norm_age,'') || ' ' || haystack,
        'de\s+(\d{1,2})\s+a\s+(\d{1,2})\s+anos');
      IF m IS NOT NULL THEN
        new_age_min := (m[1])::int;
        new_age_max := (m[2])::int;
      ELSE
        -- "a partir de X años" | "desde X años"
        m := regexp_matches(coalesce(norm_age,'') || ' ' || haystack,
          '(?:a partir de|desde)\s+(?:los\s+)?(\d{1,2})\s+anos');
        IF m IS NOT NULL THEN
          new_age_min := (m[1])::int;
        ELSE
          -- "+3", "+4", "+6", "+8", "+12"
          m := regexp_matches(coalesce(norm_age,'') || ' ' || haystack, '\+\s*(\d{1,2})(?:\s*anos)?');
          IF m IS NOT NULL THEN
            new_age_min := (m[1])::int;
          END IF;
        END IF;
      END IF;

      IF new_age_min IS NOT NULL OR new_age_max IS NOT NULL THEN
        n_age := n_age + 1;
      END IF;
    END IF;

    -- Outdoor: sólo escribir si aún NULL, señales claras
    new_outdoor := r.is_outdoor;
    IF new_outdoor IS NULL THEN
      IF (norm_title || ' ' || norm_venue || ' ' || norm_location || ' ' || norm_desc) ~
         '(aire libre|parque|jardin|playa|plaza|recinto ferial|eduardo ocon|castillo sohail|dique de levante|muelle uno)'
         AND (norm_venue || ' ' || norm_location || ' ' || norm_title) !~ '(sala|teatro|cine|auditorio cerrado|museo|centro cultural)'
      THEN
        new_outdoor := true;
        n_outdoor := n_outdoor + 1;
      END IF;
    END IF;

    -- Update sólo si algo cambió
    IF new_family IS DISTINCT FROM r.is_family_friendly
       OR new_audience IS DISTINCT FROM r.audience
       OR new_age_min IS DISTINCT FROM r.age_min
       OR new_age_max IS DISTINCT FROM r.age_max
       OR new_outdoor IS DISTINCT FROM r.is_outdoor
    THEN
      UPDATE public.events
      SET is_family_friendly = new_family,
          audience = new_audience,
          age_min = new_age_min,
          age_max = new_age_max,
          is_outdoor = new_outdoor
      WHERE id = r.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT n_family, n_kids, n_fam_aud, n_age, n_outdoor;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.backfill_event_family_flags() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_event_family_flags() FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_event_family_flags() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_event_family_flags() TO service_role;
