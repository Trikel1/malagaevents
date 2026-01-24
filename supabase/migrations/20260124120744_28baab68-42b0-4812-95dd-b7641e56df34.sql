
-- 1) Create venues table with canonical venues
CREATE TABLE public.venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  city TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Venues are publicly readable" 
ON public.venues 
FOR SELECT 
USING (true);

-- Admin management
CREATE POLICY "Admins can manage venues" 
ON public.venues 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed canonical venues
INSERT INTO public.venues (name, normalized_name, city) VALUES
  ('Sala Trinchera', 'sala-trinchera', 'Málaga'),
  ('Cochera Cabaret', 'cochera-cabaret', 'Málaga'),
  ('París 15', 'paris-15', 'Málaga'),
  ('Sala Eventual', 'sala-eventual', 'Málaga'),
  ('Sala Marte', 'sala-marte', 'Málaga'),
  ('Sin sala', 'sin-sala', NULL);

-- 2) Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  province TEXT NOT NULL DEFAULT 'Málaga',
  country TEXT NOT NULL DEFAULT 'ES',
  is_in_province_malaga BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Public read access for enabled locations
CREATE POLICY "Enabled locations are publicly readable" 
ON public.locations 
FOR SELECT 
USING (is_enabled = true);

-- Admin management
CREATE POLICY "Admins can manage locations" 
ON public.locations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial locations (Málaga province municipalities)
INSERT INTO public.locations (name, normalized_name, province, is_in_province_malaga) VALUES
  ('Málaga', 'malaga', 'Málaga', true),
  ('Torremolinos', 'torremolinos', 'Málaga', true),
  ('Benalmádena', 'benalmadena', 'Málaga', true),
  ('Fuengirola', 'fuengirola', 'Málaga', true),
  ('Marbella', 'marbella', 'Málaga', true),
  ('Estepona', 'estepona', 'Málaga', true),
  ('Rincón de la Victoria', 'rincon-de-la-victoria', 'Málaga', true),
  ('Vélez-Málaga', 'velez-malaga', 'Málaga', true),
  ('Antequera', 'antequera', 'Málaga', true),
  ('Ronda', 'ronda', 'Málaga', true),
  ('Nerja', 'nerja', 'Málaga', true),
  ('Mijas', 'mijas', 'Málaga', true),
  ('Alhaurín de la Torre', 'alhaurin-de-la-torre', 'Málaga', true),
  ('Alhaurín el Grande', 'alhaurin-el-grande', 'Málaga', true),
  ('Coín', 'coin', 'Málaga', true),
  ('Cártama', 'cartama', 'Málaga', true),
  ('Costa del Sol', 'costa-del-sol', 'Málaga', true);

-- 3) Add new columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS venue_name_raw TEXT,
ADD COLUMN IF NOT EXISTS venue_normalized TEXT,
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id),
ADD COLUMN IF NOT EXISTS location_name_raw TEXT,
ADD COLUMN IF NOT EXISTS location_normalized TEXT,
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id),
ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Málaga',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'ES',
ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe_key ON public.events(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_location_id ON public.events(location_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON public.events(source);

-- 4) Create sync_runs table for tracking imports
CREATE TABLE public.sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running',
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY "Admins can view sync runs" 
ON public.sync_runs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin management
CREATE POLICY "Admins can manage sync runs" 
ON public.sync_runs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5) Create app_config table for global settings
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Public read for non-sensitive config
CREATE POLICY "Config is publicly readable" 
ON public.app_config 
FOR SELECT 
USING (true);

-- Admin management
CREATE POLICY "Admins can manage config" 
ON public.app_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default config
INSERT INTO public.app_config (key, value, description) VALUES
  ('include_nearby_towns_outside_province', 'false', 'Allow events from towns outside Málaga province'),
  ('nearby_towns_allowlist', '[]', 'List of allowed town names outside Málaga province');

-- 6) Create trigger for updated_at on events
CREATE OR REPLACE FUNCTION public.update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_events_updated_at();
