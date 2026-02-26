
-- Add is_in_malaga_province column to sports_events
ALTER TABLE public.sports_events
  ADD COLUMN IF NOT EXISTS is_in_malaga_province boolean NOT NULL DEFAULT false;

-- Create index for province-filtered queries
CREATE INDEX IF NOT EXISTS idx_sports_events_malaga_province_date
  ON public.sports_events (is_in_malaga_province, start_date)
  WHERE is_in_malaga_province = true;
