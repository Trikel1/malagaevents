REVOKE EXECUTE ON FUNCTION public.backfill_events_dedupe_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_events_dedupe_keys() TO service_role;