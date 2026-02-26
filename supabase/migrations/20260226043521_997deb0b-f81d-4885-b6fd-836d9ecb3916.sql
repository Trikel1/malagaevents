
-- =============================================
-- SPORTS MODE: 4 new tables (completely isolated from culture mode)
-- =============================================

-- 1. sports_sources
CREATE TABLE public.sports_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  url text NOT NULL,
  sport_category text NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  items_fetched integer NOT NULL DEFAULT 0,
  items_upserted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sports_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sports sources publicly readable" ON public.sports_sources
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sports sources" ON public.sports_sources
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. sports_events
CREATE TABLE public.sports_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  sport_category text NOT NULL,
  competition text,
  teams text,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz,
  venue_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Málaga',
  address text,
  price_info text,
  tickets_url text,
  image_url text,
  source_id uuid REFERENCES public.sports_sources(id),
  source_url text,
  external_id text,
  dedupe_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sports_events_start ON public.sports_events (start_datetime);
CREATE INDEX idx_sports_events_cat_start ON public.sports_events (sport_category, start_datetime);

ALTER TABLE public.sports_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sports events publicly readable" ON public.sports_events
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sports events" ON public.sports_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. sports_venues
CREATE TABLE public.sports_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text,
  sports text[] NOT NULL DEFAULT '{}',
  city text NOT NULL DEFAULT 'Málaga',
  address text,
  lat numeric,
  lng numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sports_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sports venues publicly readable" ON public.sports_venues
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sports venues" ON public.sports_venues
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. sports_sync_runs
CREATE TABLE public.sports_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_slug text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_fetched integer NOT NULL DEFAULT 0,
  items_parsed integer NOT NULL DEFAULT 0,
  items_upserted integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  error_sample text
);

ALTER TABLE public.sports_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sports sync runs" ON public.sports_sync_runs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view sports sync runs" ON public.sports_sync_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on sports_events
CREATE OR REPLACE FUNCTION public.update_sports_events_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sports_events_updated_at
  BEFORE UPDATE ON public.sports_events
  FOR EACH ROW EXECUTE FUNCTION public.update_sports_events_updated_at();
