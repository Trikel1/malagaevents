
-- Enums
DO $$ BEGIN
  CREATE TYPE public.sports_entity_type AS ENUM ('facility', 'club', 'match', 'tournament', 'activity', 'source');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sports_entity_status AS ENUM ('verified', 'needs_review', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.sports_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type public.sports_entity_type NOT NULL,
  name TEXT NOT NULL,
  sport TEXT,
  discipline TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  date_start DATE,
  date_end DATE,
  time_start TIME,
  time_end TIME,
  organizer TEXT,
  official_url TEXT,
  registration_url TEXT,
  contact TEXT,
  price TEXT,
  age_group TEXT,
  accessibility TEXT,
  source_name TEXT,
  source_url TEXT,
  source_last_checked TIMESTAMPTZ,
  status public.sports_entity_status NOT NULL DEFAULT 'needs_review',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants (public read for verified/needs_review via policy)
GRANT SELECT ON public.sports_entities TO anon;
GRANT SELECT ON public.sports_entities TO authenticated;
GRANT ALL ON public.sports_entities TO service_role;

-- RLS
ALTER TABLE public.sports_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read visible sports entities"
  ON public.sports_entities
  FOR SELECT
  USING (status IN ('verified', 'needs_review'));

CREATE POLICY "Service role manages sports entities"
  ON public.sports_entities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sports_entities_type ON public.sports_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_sports_entities_sport ON public.sports_entities(sport);
CREATE INDEX IF NOT EXISTS idx_sports_entities_city ON public.sports_entities(city);
CREATE INDEX IF NOT EXISTS idx_sports_entities_status ON public.sports_entities(status);

-- updated_at trigger reusing existing set_updated_at()
DROP TRIGGER IF EXISTS trg_sports_entities_updated_at ON public.sports_entities;
CREATE TRIGGER trg_sports_entities_updated_at
  BEFORE UPDATE ON public.sports_entities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
