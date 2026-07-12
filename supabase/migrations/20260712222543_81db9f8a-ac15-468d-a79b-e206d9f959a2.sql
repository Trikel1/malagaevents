-- 3E-1 (a): traceability columns on event_sources.
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS write_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS write_confirmed_by uuid NULL REFERENCES auth.users(id);

COMMENT ON COLUMN public.event_sources.write_confirmed_at IS
  'Timestamp when an admin explicitly confirmed this source can perform real writes into public.events. NULL = writes forbidden.';
COMMENT ON COLUMN public.event_sources.write_confirmed_by IS
  'Admin user who confirmed the write authorization (auth.users.id).';

-- 3E-1 (b): safe defaults on events NOT NULL columns that scrape-source
-- does not populate today. Nothing gets rewritten on existing rows.
ALTER TABLE public.events
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN address SET DEFAULT '',
  ALTER COLUMN category SET DEFAULT 'general';

-- is_free, source_type, status may already have defaults; ensure they do.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events'
      AND column_name='is_free' AND column_default IS NOT NULL
  ) THEN
    EXECUTE 'ALTER TABLE public.events ALTER COLUMN is_free SET DEFAULT false';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events'
      AND column_name='source_type' AND column_default IS NOT NULL
  ) THEN
    EXECUTE 'ALTER TABLE public.events ALTER COLUMN source_type SET DEFAULT ''official_feed''';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events'
      AND column_name='status' AND column_default IS NOT NULL
  ) THEN
    EXECUTE 'ALTER TABLE public.events ALTER COLUMN status SET DEFAULT ''published''';
  END IF;
END $$;