
-- Add indexes on sports_events and sports_venues (safe, IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_sports_events_start_date ON public.sports_events (start_date);
CREATE INDEX IF NOT EXISTS idx_sports_events_start_datetime ON public.sports_events (start_datetime);
CREATE INDEX IF NOT EXISTS idx_sports_events_category_datetime ON public.sports_events (sport_category, start_datetime);
CREATE INDEX IF NOT EXISTS idx_sports_events_normalized_venue ON public.sports_events (normalized_venue);
CREATE INDEX IF NOT EXISTS idx_sports_venues_normalized_name ON public.sports_venues (normalized_name);
CREATE INDEX IF NOT EXISTS idx_sports_venues_city ON public.sports_venues (city);
