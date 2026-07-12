CREATE OR REPLACE FUNCTION public.backfill_events_dedupe_keys()
RETURNS TABLE(updated_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  computed_key text;
  updated_n integer := 0;
  skipped_n integer := 0;
BEGIN
  FOR r IN
    SELECT id, title, venue_name, start_at
    FROM public.events
    WHERE dedupe_key IS NULL
      AND title IS NOT NULL
      AND start_at IS NOT NULL
  LOOP
    computed_key := encode(
      extensions.digest(
        (public.normalize_text(r.title) ||
         '|' ||
         public.normalize_text(coalesce(r.venue_name, '')) ||
         '|' ||
         to_char(r.start_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI'))::bytea,
        'sha256'
      ),
      'hex'
    );

    BEGIN
      UPDATE public.events
      SET dedupe_key = computed_key
      WHERE id = r.id;
      updated_n := updated_n + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped_n := skipped_n + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT updated_n, skipped_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_events_dedupe_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_events_dedupe_keys() TO service_role;