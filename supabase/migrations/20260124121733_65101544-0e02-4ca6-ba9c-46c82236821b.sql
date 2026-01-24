
-- 1) Add new venues for the 7 sources
INSERT INTO public.venues (name, normalized_name, city) VALUES
  ('Teatro del Soho CaixaBank', 'teatro-del-soho-caixabank', 'Málaga'),
  ('Teatro Cervantes', 'teatro-cervantes', 'Málaga'),
  ('Teatro Echegaray', 'teatro-echegaray', 'Málaga'),
  ('Antojo Málaga', 'antojo-malaga', 'Málaga'),
  ('La Térmica', 'la-termica', 'Málaga')
ON CONFLICT (normalized_name) DO NOTHING;

-- 2) Add website column to venues
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS website TEXT;

-- 3) Create event_occurrences table for calendar (multiple dates/times per event)
CREATE TABLE IF NOT EXISTS public.event_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE,
  buy_url TEXT,
  sold_out BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_occurrences ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Occurrences are publicly readable" 
ON public.event_occurrences 
FOR SELECT 
USING (true);

-- Admin management
CREATE POLICY "Admins can manage occurrences" 
ON public.event_occurrences 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_occurrences_event_id ON public.event_occurrences(event_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_start_datetime ON public.event_occurrences(start_datetime);
CREATE INDEX IF NOT EXISTS idx_occurrences_date_range ON public.event_occurrences(start_datetime, end_datetime);

-- 4) Add missing fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS description_short TEXT,
ADD COLUMN IF NOT EXISTS description_full TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS buy_url TEXT;

-- 5) Create text search index for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create function for normalized text search
CREATE OR REPLACE FUNCTION public.normalize_text(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(unaccent(coalesce(text_input, '')));
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Add normalized columns for search
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS title_normalized TEXT GENERATED ALWAYS AS (normalize_text(title)) STORED,
ADD COLUMN IF NOT EXISTS venue_name_normalized TEXT GENERATED ALWAYS AS (normalize_text(venue_name)) STORED;

-- Create GIN indexes for text search
CREATE INDEX IF NOT EXISTS idx_events_title_normalized ON public.events USING gin(to_tsvector('spanish', coalesce(title_normalized, '')));
CREATE INDEX IF NOT EXISTS idx_events_venue_normalized ON public.events USING gin(to_tsvector('spanish', coalesce(venue_name_normalized, '')));

-- 6) Trigger for updated_at on occurrences
CREATE TRIGGER update_occurrences_updated_at
BEFORE UPDATE ON public.event_occurrences
FOR EACH ROW
EXECUTE FUNCTION public.update_events_updated_at();

-- 7) Update sync_runs to track per-source stats better
ALTER TABLE public.sync_runs
ADD COLUMN IF NOT EXISTS occurrences_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS events_archived INTEGER DEFAULT 0;
