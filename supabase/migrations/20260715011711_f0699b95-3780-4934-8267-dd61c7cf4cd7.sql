-- Whitelist enforcement for pharmacies_guard: only rows coming from a verifiable
-- official source may be stored. This guarantees the "de guardia" UI can never
-- surface fabricated or estimated rotations, no matter what caller inserts.

-- 1. Purge historical fabricated / non-official rows.
DELETE FROM public.pharmacies_guard
WHERE source_ref IS NULL
   OR source_ref = ''
   OR lower(source_ref) IN ('fallback', 'rotation', 'fake', 'directorio local málaga', 'directorio local malaga', 'local', 'estimated');

-- 2. Enforce whitelist at write time.
CREATE OR REPLACE FUNCTION public.pharmacies_guard_enforce_official_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  src text := lower(coalesce(NEW.source_ref, ''));
BEGIN
  IF src = '' THEN
    RAISE EXCEPTION 'pharmacies_guard.source_ref is required and must reference an official source';
  END IF;

  IF NOT (
    src LIKE '%farmaciasguardia.farmaceuticos.com%'
    OR src LIKE '%farmaceuticos.com%'
    OR src LIKE '%icofma.es%'
    OR src LIKE '%cofmalaga.com%'
    OR src LIKE '%cgcof.es%'
  ) THEN
    RAISE EXCEPTION 'pharmacies_guard.source_ref "%" is not an approved official source', NEW.source_ref;
  END IF;

  IF NEW.date_from IS NULL OR NEW.date_to IS NULL THEN
    RAISE EXCEPTION 'pharmacies_guard requires date_from and date_to';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pharmacies_guard_official_source ON public.pharmacies_guard;
CREATE TRIGGER pharmacies_guard_official_source
BEFORE INSERT OR UPDATE ON public.pharmacies_guard
FOR EACH ROW EXECUTE FUNCTION public.pharmacies_guard_enforce_official_source();

-- 3. Helpful index for date-range queries.
CREATE INDEX IF NOT EXISTS idx_pharmacies_guard_date_range
  ON public.pharmacies_guard (date_from, date_to);

-- 4. Small metadata record for the last successful sync attempt against the
--    official source, so the UI can show "actualizado hace X" honestly.
INSERT INTO public.app_config (key, value)
VALUES ('pharmacies_guard_last_sync', jsonb_build_object('status', 'unknown', 'updated_at', now()))
ON CONFLICT (key) DO NOTHING;