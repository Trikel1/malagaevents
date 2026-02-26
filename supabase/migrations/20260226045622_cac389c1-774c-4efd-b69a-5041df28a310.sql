-- Step 1: Add missing columns
ALTER TABLE public.sports_events ADD COLUMN IF NOT EXISTS normalized_title text;
ALTER TABLE public.sports_events ADD COLUMN IF NOT EXISTS normalized_venue text;
ALTER TABLE public.sports_events ADD COLUMN IF NOT EXISTS start_date date;

-- Step 2a: Backfill start_date with timezone conversion
UPDATE public.sports_events
SET start_date = (start_datetime AT TIME ZONE 'Europe/Madrid')::date
WHERE start_date IS NULL;

-- Step 2b: Fallback for any remaining NULLs
UPDATE public.sports_events
SET start_date = (now() AT TIME ZONE 'Europe/Madrid')::date
WHERE start_date IS NULL;

-- Step 3: Set NOT NULL
ALTER TABLE public.sports_events ALTER COLUMN start_date SET NOT NULL;

-- Step 4: Create set_updated_at() helper function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Step 5: Create sports_is_admin() placeholder
-- NOTE: Placeholder ONLY. NOT used for any write-access RLS policy.
-- All writes are done via SERVICE_ROLE (bypasses RLS). Public-facing RLS is SELECT-only.
CREATE OR REPLACE FUNCTION public.sports_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT auth.role() = 'authenticated';
$$;

-- Step 6: Add triggers using safe DO blocks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sports_sources_updated_at') THEN
    CREATE TRIGGER trg_sports_sources_updated_at
    BEFORE UPDATE ON public.sports_sources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sports_venues_updated_at') THEN
    CREATE TRIGGER trg_sports_venues_updated_at
    BEFORE UPDATE ON public.sports_venues
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Step 7: Add indexes (only the 3 requested)
CREATE INDEX IF NOT EXISTS idx_sports_events_start_date ON public.sports_events(start_date);
CREATE INDEX IF NOT EXISTS idx_sports_events_start_datetime ON public.sports_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_sports_events_category_start ON public.sports_events(sport_category, start_datetime);