-- Add event_type column to events for category-specific fallback images
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'other';

-- Add image_status column to track image state
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS image_status text DEFAULT 'pending';

-- Create index for event_type queries
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

-- Update existing events with event_type based on source/category
UPDATE public.events SET event_type = 'theater' WHERE source IN ('teatro-soho', 'teatro-cervantes') AND event_type = 'other';
UPDATE public.events SET event_type = 'music' WHERE source IN ('eventual-music', 'sala-trinchera', 'paris-15', 'sala-marte', 'antojo-malaga') AND event_type = 'other';
UPDATE public.events SET event_type = category WHERE event_type = 'other' AND category IN ('theater', 'music', 'comedy', 'festival');

-- Update image_status for events with valid images
UPDATE public.events SET image_status = 'ok' WHERE image_url IS NOT NULL AND image_url != '';
UPDATE public.events SET image_status = 'missing' WHERE image_url IS NULL OR image_url = '';