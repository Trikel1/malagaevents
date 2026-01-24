-- Table to store discovered source configurations
CREATE TABLE IF NOT EXISTS public.sources_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  entrypoints_detected text[] DEFAULT '{}',
  chosen_entrypoint text,
  fallback_entrypoint text,
  event_type text DEFAULT 'other',
  category text DEFAULT 'other',
  default_venue text,
  default_location text DEFAULT 'Málaga',
  discovery_confidence integer DEFAULT 0,
  last_discovery_at timestamptz,
  last_sync_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sources_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Sources config publicly readable" ON public.sources_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage sources config" ON public.sources_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Index
CREATE INDEX IF NOT EXISTS idx_sources_config_domain ON public.sources_config(domain);
CREATE INDEX IF NOT EXISTS idx_sources_config_slug ON public.sources_config(slug);

-- Seed initial sources
INSERT INTO public.sources_config (domain, name, slug, fallback_entrypoint, event_type, category, default_venue, default_location) VALUES
  ('teatrodelsoho.com', 'Teatro del Soho CaixaBank', 'teatro-soho', 'https://teatrodelsoho.com/', 'theater', 'theater', 'Teatro del Soho CaixaBank', 'Málaga'),
  ('www.teatrocervantes.com', 'Teatro Cervantes', 'teatro-cervantes', 'https://www.teatrocervantes.com/', 'theater', 'theater', 'Teatro Cervantes', 'Málaga'),
  ('www.eventualmusic.com', 'Sala Eventual', 'eventual-music', 'https://www.eventualmusic.com/', 'music', 'music', 'Sala Eventual', 'Málaga'),
  ('salatrinchera.com', 'Sala Trinchera', 'sala-trinchera', 'https://salatrinchera.com/', 'music', 'music', 'Sala Trinchera', 'Málaga'),
  ('paris15.es', 'París 15', 'paris-15', 'https://paris15.es/', 'nightlife', 'nightlife', 'París 15', 'Málaga'),
  ('salamartemalaga.com', 'Sala Marte', 'sala-marte', 'https://salamartemalaga.com/', 'music', 'music', 'Sala Marte', 'Málaga'),
  ('antojomalaga.es', 'Antojo Málaga', 'antojo-malaga', 'https://antojomalaga.es/', 'music', 'music', 'Antojo Málaga', 'Málaga')
ON CONFLICT (domain) DO NOTHING;