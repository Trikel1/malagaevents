
-- Drop the broken trigger on sports_sources (references non-existent updated_at column)
DROP TRIGGER IF EXISTS set_updated_at ON public.sports_sources;
