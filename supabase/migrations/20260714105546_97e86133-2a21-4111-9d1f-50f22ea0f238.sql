
-- ── 1. Additive columns (reuse existing official_url) ──────────────────────
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS canonical_venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS former_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS primary_source_type text,
  ADD COLUMN IF NOT EXISTS events_frequency text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_confidence text,
  ADD COLUMN IF NOT EXISTS is_publicly_visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_venues_status ON public.venues(status);
CREATE INDEX IF NOT EXISTS idx_venues_public_visible ON public.venues(is_publicly_visible) WHERE is_publicly_visible = true;
CREATE INDEX IF NOT EXISTS idx_venues_canonical ON public.venues(canonical_venue_id);

-- ── 2. Update existing canonical Málaga capital venues ─────────────────────
UPDATE public.venues SET
  name = 'Sala París 15', short_name = 'París 15',
  venue_type = 'concert_hall', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'official_website',
  official_url = COALESCE(official_url, 'https://www.paris15.es'),
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = '03d92ed3-afd0-4645-8876-13502592883d';

UPDATE public.venues SET
  venue_type = 'concert_hall', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'official_website',
  official_url = COALESCE(official_url, 'https://salatrinchera.com'),
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = '4d9d95c8-e36e-48b1-ae02-a5ead532c8f0';

UPDATE public.venues SET
  venue_type = 'concert_hall', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'social_or_official',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = '92bba58a-2dd9-4e66-9d9d-cb331ac95688';

UPDATE public.venues SET
  venue_type = 'multidisciplinary_venue', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'official_website',
  official_url = COALESCE(official_url, 'https://lacocheracabaret.com'),
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = 'c96c7ded-d59d-4539-8aca-33e9d1d27ba4';

UPDATE public.venues SET
  venue_type = 'multidisciplinary_venue', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'official_website',
  official_url = COALESCE(official_url, 'https://www.latermicamalaga.com'),
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = '3ac82d2f-bb03-45b3-9a8c-c3ba028d33ce';

UPDATE public.venues SET
  canonical_venue_id = '3ac82d2f-bb03-45b3-9a8c-c3ba028d33ce',
  status = 'active', is_publicly_visible = false
WHERE id = '56772bb5-d16e-433a-8dde-06d1372dc2f3';

UPDATE public.venues SET
  name = 'Fábrica de Cervezas Victoria', short_name = 'Fábrica Victoria',
  venue_type = 'multidisciplinary_venue', status = 'active',
  events_frequency = 'occasional', primary_source_type = 'official_or_editorial',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = '790ffb36-791e-4e04-93f2-78ca713e1e44';

-- ── 3. FYCMA consolidation ─────────────────────────────────────────────────
UPDATE public.events
SET venue_id = 'cb2e43bd-bef9-4a3b-b27c-9e5a73474c12'
WHERE venue_id IN (
  'e492194c-e0fd-4801-af76-50bc3ab7836a',
  '7bb158eb-5e36-4333-9250-a56ddf24d236'
);

UPDATE public.venues SET
  name = 'FYCMA – Palacio de Ferias y Congresos de Málaga',
  short_name = 'FYCMA', venue_type = 'large_event_venue', status = 'active',
  events_frequency = 'frequent', primary_source_type = 'official_website',
  official_url = COALESCE(official_url, 'https://www.fycma.com'),
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true
WHERE id = 'cb2e43bd-bef9-4a3b-b27c-9e5a73474c12';

UPDATE public.venues SET
  canonical_venue_id = 'cb2e43bd-bef9-4a3b-b27c-9e5a73474c12',
  status = 'renamed', is_publicly_visible = false, is_featured = false
WHERE id IN (
  'e492194c-e0fd-4801-af76-50bc3ab7836a',
  '7bb158eb-5e36-4333-9250-a56ddf24d236'
);

-- ── 4. Insert missing canonical venues ─────────────────────────────────────

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, former_names, instagram_url, instagram_handle,
  primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('Sala Core', 'sala-core', 'Málaga', 'concert_hall', 'active',
  'Core', ARRAY['Velvet Club','Sala Velvet','Velvet Málaga','Velvet'],
  'https://www.instagram.com/core.disco', 'core.disco',
  'instagram', 'frequent', 'confirmed', now(), true, true)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'concert_hall', status = 'active',
  short_name = EXCLUDED.short_name, former_names = EXCLUDED.former_names,
  instagram_url = EXCLUDED.instagram_url, instagram_handle = EXCLUDED.instagram_handle,
  primary_source_type = 'instagram', events_frequency = 'frequent',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, instagram_url, instagram_handle,
  primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('ZZ Pub', 'zz-pub', 'Málaga', 'live_music_bar', 'social_only',
  'ZZ Pub', 'https://www.instagram.com/zzpub', 'zzpub',
  'instagram', 'near_daily', 'confirmed', now(), true, true)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'live_music_bar', status = 'social_only',
  short_name = EXCLUDED.short_name,
  instagram_url = EXCLUDED.instagram_url, instagram_handle = EXCLUDED.instagram_handle,
  primary_source_type = 'instagram', events_frequency = 'near_daily',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, instagram_url, instagram_handle,
  primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('Road House Málaga', 'road-house-malaga', 'Málaga', 'live_music_bar', 'social_only',
  'Road House', 'https://www.instagram.com/roadhousemlg', 'roadhousemlg',
  'instagram', 'near_daily', 'confirmed', now(), true, true)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'live_music_bar', status = 'social_only',
  short_name = EXCLUDED.short_name,
  instagram_url = EXCLUDED.instagram_url, instagram_handle = EXCLUDED.instagram_handle,
  primary_source_type = 'instagram', events_frequency = 'near_daily',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('Málaga Forum', 'malaga-forum', 'Málaga', 'large_event_venue', 'active',
  'Málaga Forum', 'official_or_ticketing', 'occasional', 'medium',
  now(), true, true)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'large_event_venue', status = 'active',
  primary_source_type = 'official_or_ticketing', events_frequency = 'occasional',
  last_verified_at = now(), is_publicly_visible = true, is_featured = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('Palacio de Deportes José María Martín Carpena', 'palacio-de-deportes-jose-maria-martin-carpena',
  'Málaga', 'large_event_venue', 'active',
  'Martín Carpena', 'official_or_ticketing', 'frequent', 'confirmed',
  now(), true, true)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'large_event_venue', status = 'active',
  short_name = EXCLUDED.short_name,
  primary_source_type = 'official_or_ticketing', events_frequency = 'frequent',
  verification_confidence = 'confirmed', last_verified_at = now(),
  is_publicly_visible = true, is_featured = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, primary_source_type, events_frequency, verification_confidence,
  last_verified_at, is_publicly_visible, is_featured)
VALUES ('Auditorio Municipal Cortijo de Torres', 'auditorio-municipal-cortijo-de-torres',
  'Málaga', 'seasonal_outdoor', 'seasonal',
  'Auditorio Municipal', 'municipal_or_official', 'seasonal', 'medium',
  now(), true, false)
ON CONFLICT (normalized_name) DO UPDATE SET
  venue_type = 'seasonal_outdoor', status = 'seasonal',
  short_name = EXCLUDED.short_name,
  primary_source_type = 'municipal_or_official', events_frequency = 'seasonal',
  last_verified_at = now(), is_publicly_visible = true;

INSERT INTO public.venues (name, normalized_name, city, venue_type, status,
  short_name, verification_confidence, last_verified_at, is_publicly_visible, is_featured)
VALUES ('Sala Vivero', 'sala-vivero', 'Málaga', 'concert_hall', 'closed',
  'Sala Vivero', 'medium', now(), false, false)
ON CONFLICT (normalized_name) DO UPDATE SET
  status = 'closed', is_publicly_visible = false, is_featured = false,
  last_verified_at = now();

-- ── 5. Aliases (idempotent) ────────────────────────────────────────────────
DO $$
DECLARE
  v_core uuid; v_zz uuid; v_road uuid; v_carpena uuid; v_forum uuid;
  v_auditorio uuid; v_marte uuid; v_paris uuid; v_trinchera uuid;
  v_fycma uuid; v_fabrica uuid; v_cochera uuid;
BEGIN
  SELECT id INTO v_core FROM public.venues WHERE normalized_name = 'sala-core';
  SELECT id INTO v_zz FROM public.venues WHERE normalized_name = 'zz-pub';
  SELECT id INTO v_road FROM public.venues WHERE normalized_name = 'road-house-malaga';
  SELECT id INTO v_carpena FROM public.venues WHERE normalized_name = 'palacio-de-deportes-jose-maria-martin-carpena';
  SELECT id INTO v_forum FROM public.venues WHERE normalized_name = 'malaga-forum';
  SELECT id INTO v_auditorio FROM public.venues WHERE normalized_name = 'auditorio-municipal-cortijo-de-torres';
  v_marte := '92bba58a-2dd9-4e66-9d9d-cb331ac95688';
  v_paris := '03d92ed3-afd0-4645-8876-13502592883d';
  v_trinchera := '4d9d95c8-e36e-48b1-ae02-a5ead532c8f0';
  v_fycma := 'cb2e43bd-bef9-4a3b-b27c-9e5a73474c12';
  v_fabrica := '790ffb36-791e-4e04-93f2-78ca713e1e44';
  v_cochera := 'c96c7ded-d59d-4539-8aca-33e9d1d27ba4';

  INSERT INTO public.venue_aliases (alias, canonical_name, venue_id) VALUES
    ('Velvet Club','Sala Core',v_core),
    ('Sala Velvet','Sala Core',v_core),
    ('Velvet Málaga','Sala Core',v_core),
    ('Velvet','Sala Core',v_core),
    ('Core Disco','Sala Core',v_core),
    ('Core Málaga','Sala Core',v_core),
    ('Sala Core Málaga','Sala Core',v_core),
    ('ZZPub','ZZ Pub',v_zz),
    ('ZZ-Pub','ZZ Pub',v_zz),
    ('ZZ Málaga','ZZ Pub',v_zz),
    ('Road House','Road House Málaga',v_road),
    ('Roadhouse Málaga','Road House Málaga',v_road),
    ('Road House MLG','Road House Málaga',v_road),
    ('Roadhouse MLG','Road House Málaga',v_road),
    ('Road House Malaga','Road House Málaga',v_road),
    ('Roadhouse Malaga','Road House Málaga',v_road),
    ('Martín Carpena','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('Martin Carpena','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('Palacio Martín Carpena','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('José María Martín Carpena','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('Palacio de Deportes de Málaga','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('Palacio de Deportes Martín Carpena','Palacio de Deportes José María Martín Carpena',v_carpena),
    ('Forum Málaga','Málaga Forum',v_forum),
    ('Málaga Forum Arena','Málaga Forum',v_forum),
    ('Forum Arena Málaga','Málaga Forum',v_forum),
    ('Auditorio Municipal de Málaga','Auditorio Municipal Cortijo de Torres',v_auditorio),
    ('Auditorio Cortijo de Torres','Auditorio Municipal Cortijo de Torres',v_auditorio),
    ('Cortijo de Torres','Auditorio Municipal Cortijo de Torres',v_auditorio),
    ('Auditorio de la Feria','Auditorio Municipal Cortijo de Torres',v_auditorio),
    ('Marte Málaga','Sala Marte',v_marte),
    ('Sala Marte Málaga','Sala Marte',v_marte),
    ('Sala Marte MLG','Sala Marte',v_marte),
    ('Paris 15','Sala París 15',v_paris),
    ('Paris15','Sala París 15',v_paris),
    ('Trinchera','Sala Trinchera',v_trinchera),
    ('Palacio de Ferias y Congresos de Málaga','FYCMA – Palacio de Ferias y Congresos de Málaga',v_fycma),
    ('Palacio de Ferias Málaga','FYCMA – Palacio de Ferias y Congresos de Málaga',v_fycma),
    ('Palacio de Congresos de Málaga','FYCMA – Palacio de Ferias y Congresos de Málaga',v_fycma),
    ('FYCMA','FYCMA – Palacio de Ferias y Congresos de Málaga',v_fycma),
    ('Fábrica Victoria','Fábrica de Cervezas Victoria',v_fabrica),
    ('Cervezas Victoria','Fábrica de Cervezas Victoria',v_fabrica),
    ('Fábrica de Cerveza Victoria','Fábrica de Cervezas Victoria',v_fabrica),
    ('La Cochera','La Cochera Cabaret',v_cochera),
    ('Cochera Cabaret','La Cochera Cabaret',v_cochera)
  ON CONFLICT (alias_normalized) DO NOTHING;
END $$;
