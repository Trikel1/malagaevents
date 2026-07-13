
-- =========================================================================
-- Fase 1 — Agenda Cultural provincial (aditivo, reversible)
-- =========================================================================

-- 1) municipalities ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ine_code text UNIQUE NOT NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  comarca text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.municipalities TO anon, authenticated;
GRANT ALL ON public.municipalities TO service_role;

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Municipalities are publicly readable" ON public.municipalities;
CREATE POLICY "Municipalities are publicly readable"
  ON public.municipalities FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_municipalities_comarca ON public.municipalities (comarca);
CREATE INDEX IF NOT EXISTS idx_municipalities_active ON public.municipalities (active) WHERE active;
CREATE INDEX IF NOT EXISTS idx_municipalities_lat_lng ON public.municipalities (latitude, longitude);

DROP TRIGGER IF EXISTS trg_municipalities_updated_at ON public.municipalities;
CREATE TRIGGER trg_municipalities_updated_at
  BEFORE UPDATE ON public.municipalities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2) municipality_aliases ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.municipality_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_normalized text NOT NULL,
  alias_type text NOT NULL DEFAULT 'nucleo',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alias_normalized)
);

GRANT SELECT ON public.municipality_aliases TO anon, authenticated;
GRANT ALL ON public.municipality_aliases TO service_role;

ALTER TABLE public.municipality_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Municipality aliases are publicly readable" ON public.municipality_aliases;
CREATE POLICY "Municipality aliases are publicly readable"
  ON public.municipality_aliases FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_municipality_aliases_municipality ON public.municipality_aliases (municipality_id);
CREATE INDEX IF NOT EXISTS idx_municipality_aliases_alias_norm ON public.municipality_aliases (alias_normalized);


-- 3) events: columnas nuevas (aditivo) --------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS locality_or_district text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS minimum_age integer;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_from numeric(10,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS price_to numeric(10,2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS lifecycle_status text;

-- CHECK constraint solo si aún no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_lifecycle_status_check
      CHECK (lifecycle_status IS NULL OR lifecycle_status IN
        ('scheduled','postponed','cancelled','sold_out','finished','needs_review'));
  END IF;
END $$;


-- 4) venues: columnas nuevas ------------------------------------------------
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS locality_or_district text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS accessibility_data jsonb;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS official_url text;


-- 5) event_sources: columnas nuevas -----------------------------------------
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id) ON DELETE SET NULL;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS trust_level integer;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS licence text;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS terms_reviewed_at timestamptz;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS polling_interval interval;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS consecutive_errors integer NOT NULL DEFAULT 0;
ALTER TABLE public.event_sources ADD COLUMN IF NOT EXISTS paused_reason text;


-- 6) Índices adicionales ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_start_at ON public.events (start_at);
CREATE INDEX IF NOT EXISTS idx_events_municipality_lifecycle ON public.events (municipality_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_events_category_start ON public.events (category, start_at);
CREATE INDEX IF NOT EXISTS idx_events_lat_lng ON public.events (lat, lng);
CREATE INDEX IF NOT EXISTS idx_events_verified_at ON public.events (verified_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_source_external
  ON public.events (source_id, external_id)
  WHERE external_id IS NOT NULL AND source_id IS NOT NULL;


-- 7) Seed de los 103 municipios de Málaga ----------------------------------
INSERT INTO public.municipalities (ine_code, name, slug, comarca, latitude, longitude) VALUES
('29001','Alameda','alameda','Antequera',37.2050,-4.6600),
('29002','Alcaucín','alcaucin','Axarquía',36.9000,-4.1200),
('29003','Alfarnate','alfarnate','Axarquía',36.9950,-4.2600),
('29004','Alfarnatejo','alfarnatejo','Axarquía',36.9600,-4.2600),
('29005','Algarrobo','algarrobo','Axarquía',36.7700,-4.0400),
('29006','Algatocín','algatocin','Serranía de Ronda',36.5800,-5.2700),
('29007','Alhaurín de la Torre','alhaurin-de-la-torre','Valle del Guadalhorce',36.6600,-4.5600),
('29008','Alhaurín el Grande','alhaurin-el-grande','Valle del Guadalhorce',36.6400,-4.6900),
('29009','Almáchar','almachar','Axarquía',36.7900,-4.2000),
('29010','Almargen','almargen','Guadalteba',37.0000,-5.0300),
('29011','Almogía','almogia','Valle del Guadalhorce',36.8300,-4.5400),
('29012','Álora','alora','Valle del Guadalhorce',36.8200,-4.7000),
('29013','Alozaina','alozaina','Sierra de las Nieves',36.7300,-4.8500),
('29014','Alpandeire','alpandeire','Serranía de Ronda',36.6400,-5.1900),
('29015','Antequera','antequera','Antequera',37.0200,-4.5600),
('29016','Árchez','archez','Axarquía',36.8300,-4.0000),
('29017','Archidona','archidona','Antequera',37.0900,-4.3900),
('29018','Ardales','ardales','Guadalteba',36.8800,-4.8500),
('29019','Arenas','arenas','Axarquía',36.8200,-4.0400),
('29020','Arriate','arriate','Serranía de Ronda',36.8100,-5.1400),
('29021','Atajate','atajate','Serranía de Ronda',36.6600,-5.2400),
('29022','Benadalid','benadalid','Serranía de Ronda',36.6300,-5.2600),
('29023','Benahavís','benahavis','Costa del Sol Occidental',36.5200,-5.0400),
('29024','Benalauría','benalauria','Serranía de Ronda',36.6100,-5.2700),
('29025','Benalmádena','benalmadena','Costa del Sol Occidental',36.5990,-4.5160),
('29026','Benamargosa','benamargosa','Axarquía',36.8300,-4.1900),
('29027','Benamocarra','benamocarra','Axarquía',36.7900,-4.1500),
('29028','Benaoján','benaojan','Serranía de Ronda',36.7100,-5.2400),
('29029','Benarrabá','benarraba','Serranía de Ronda',36.5500,-5.2700),
('29030','Borge, El','el-borge','Axarquía',36.8100,-4.2200),
('29031','Burgo, El','el-burgo','Sierra de las Nieves',36.7900,-4.9400),
('29032','Campillos','campillos','Guadalteba',37.0500,-4.8600),
('29033','Canillas de Aceituno','canillas-de-aceituno','Axarquía',36.8600,-4.1000),
('29034','Canillas de Albaida','canillas-de-albaida','Axarquía',36.8400,-4.0000),
('29035','Cañete la Real','canete-la-real','Guadalteba',36.9500,-5.0000),
('29036','Carratraca','carratraca','Guadalteba',36.8500,-4.8300),
('29037','Cartajima','cartajima','Serranía de Ronda',36.6600,-5.1600),
('29038','Cártama','cartama','Valle del Guadalhorce',36.7100,-4.6300),
('29039','Casabermeja','casabermeja','Antequera',36.8900,-4.4300),
('29040','Casarabonela','casarabonela','Sierra de las Nieves',36.7900,-4.8400),
('29041','Casares','casares','Costa del Sol Occidental',36.4400,-5.2700),
('29042','Coín','coin','Valle del Guadalhorce',36.6600,-4.7500),
('29043','Colmenar','colmenar','Axarquía',36.9000,-4.3400),
('29044','Comares','comares','Axarquía',36.8500,-4.2000),
('29045','Cómpeta','competa','Axarquía',36.8400,-3.9700),
('29046','Cortes de la Frontera','cortes-de-la-frontera','Serranía de Ronda',36.6200,-5.3400),
('29047','Cuevas Bajas','cuevas-bajas','Antequera',37.2700,-4.4700),
('29048','Cuevas del Becerro','cuevas-del-becerro','Serranía de Ronda',36.8700,-5.0300),
('29049','Cuevas de San Marcos','cuevas-de-san-marcos','Antequera',37.2700,-4.4000),
('29050','Cútar','cutar','Axarquía',36.8300,-4.2400),
('29051','Estepona','estepona','Costa del Sol Occidental',36.4260,-5.1470),
('29052','Faraján','farajan','Serranía de Ronda',36.6300,-5.2000),
('29053','Frigiliana','frigiliana','Axarquía',36.7900,-3.8900),
('29054','Fuengirola','fuengirola','Costa del Sol Occidental',36.5390,-4.6250),
('29055','Fuente de Piedra','fuente-de-piedra','Antequera',37.1400,-4.7300),
('29056','Gaucín','gaucin','Serranía de Ronda',36.5200,-5.3200),
('29057','Genalguacil','genalguacil','Serranía de Ronda',36.5500,-5.2400),
('29058','Guaro','guaro','Sierra de las Nieves',36.6800,-4.8700),
('29059','Humilladero','humilladero','Antequera',37.1000,-4.7100),
('29060','Igualeja','igualeja','Serranía de Ronda',36.6400,-5.1400),
('29061','Istán','istan','Sierra de las Nieves',36.5700,-4.9500),
('29062','Iznate','iznate','Axarquía',36.7900,-4.1800),
('29063','Jimera de Líbar','jimera-de-libar','Serranía de Ronda',36.6600,-5.2700),
('29064','Jubrique','jubrique','Serranía de Ronda',36.5700,-5.2200),
('29065','Júzcar','juzcar','Serranía de Ronda',36.6500,-5.1700),
('29066','Macharaviaya','macharaviaya','Axarquía',36.7600,-4.2100),
('29067','Málaga','malaga','Málaga',36.7213,-4.4214),
('29068','Manilva','manilva','Costa del Sol Occidental',36.3760,-5.2500),
('29069','Marbella','marbella','Costa del Sol Occidental',36.5100,-4.8850),
('29070','Mijas','mijas','Costa del Sol Occidental',36.5960,-4.6370),
('29071','Moclinejo','moclinejo','Axarquía',36.7700,-4.2600),
('29072','Mollina','mollina','Antequera',37.1300,-4.6500),
('29073','Monda','monda','Sierra de las Nieves',36.6300,-4.8300),
('29074','Montejaque','montejaque','Serranía de Ronda',36.7300,-5.2500),
('29075','Nerja','nerja','Axarquía',36.7500,-3.8770),
('29076','Ojén','ojen','Costa del Sol Occidental',36.5600,-4.8600),
('29077','Parauta','parauta','Serranía de Ronda',36.6400,-5.1400),
('29078','Periana','periana','Axarquía',36.9200,-4.2000),
('29079','Pizarra','pizarra','Valle del Guadalhorce',36.7700,-4.7100),
('29080','Pujerra','pujerra','Serranía de Ronda',36.6300,-5.1700),
('29081','Rincón de la Victoria','rincon-de-la-victoria','Axarquía',36.7160,-4.2790),
('29082','Riogordo','riogordo','Axarquía',36.9200,-4.2900),
('29083','Ronda','ronda','Serranía de Ronda',36.7400,-5.1650),
('29084','Salares','salares','Axarquía',36.8500,-4.0400),
('29085','Sayalonga','sayalonga','Axarquía',36.8100,-4.0000),
('29086','Sedella','sedella','Axarquía',36.8700,-4.0800),
('29087','Sierra de Yeguas','sierra-de-yeguas','Guadalteba',37.1300,-4.8700),
('29088','Teba','teba','Guadalteba',36.9800,-4.9200),
('29089','Tolox','tolox','Sierra de las Nieves',36.6900,-4.9100),
('29090','Torrox','torrox','Axarquía',36.7600,-3.9600),
('29091','Totalán','totalan','Axarquía',36.7600,-4.3000),
('29092','Valle de Abdalajís','valle-de-abdalajis','Antequera',36.9200,-4.6400),
('29093','Vélez-Málaga','velez-malaga','Axarquía',36.7800,-4.1000),
('29094','Villanueva de Algaidas','villanueva-de-algaidas','Antequera',37.1800,-4.4500),
('29095','Villanueva del Rosario','villanueva-del-rosario','Antequera',37.0400,-4.3600),
('29096','Villanueva del Trabuco','villanueva-del-trabuco','Antequera',37.0700,-4.3200),
('29097','Villanueva de Tapia','villanueva-de-tapia','Antequera',37.1800,-4.3200),
('29098','Viñuela','vinuela','Axarquía',36.8600,-4.1600),
('29099','Yunquera','yunquera','Sierra de las Nieves',36.7300,-4.9500),
('29901','Torremolinos','torremolinos','Costa del Sol Occidental',36.6200,-4.5000),
('29902','Serrato','serrato','Serranía de Ronda',36.8800,-5.0300),
('29903','Montecorto','montecorto','Serranía de Ronda',36.7900,-5.2600)
ON CONFLICT (ine_code) DO NOTHING;


-- 8) Seed de aliases de núcleos y pedanías --------------------------------
WITH m AS (
  SELECT id, slug FROM public.municipalities
)
INSERT INTO public.municipality_aliases (municipality_id, alias, alias_normalized, alias_type)
SELECT m.id, v.alias, public.normalize_text(v.alias), v.alias_type
FROM m JOIN (VALUES
  ('velez-malaga','Torre del Mar','nucleo'),
  ('velez-malaga','Caleta de Vélez','nucleo'),
  ('velez-malaga','Almayate','nucleo'),
  ('velez-malaga','Chilches','nucleo'),
  ('velez-malaga','Benajarafe','nucleo'),
  ('marbella','San Pedro Alcántara','nucleo'),
  ('marbella','San Pedro de Alcántara','nucleo'),
  ('marbella','Nueva Andalucía','nucleo'),
  ('marbella','Puerto Banús','nucleo'),
  ('marbella','Las Chapas','nucleo'),
  ('benalmadena','Arroyo de la Miel','nucleo'),
  ('benalmadena','Benalmádena Costa','nucleo'),
  ('benalmadena','Benalmádena Pueblo','nucleo'),
  ('manilva','Sabinillas','nucleo'),
  ('manilva','San Luis de Sabinillas','nucleo'),
  ('manilva','Puerto de la Duquesa','nucleo'),
  ('mijas','La Cala de Mijas','nucleo'),
  ('mijas','Mijas Costa','nucleo'),
  ('mijas','Mijas Pueblo','nucleo'),
  ('mijas','Las Lagunas','nucleo'),
  ('torrox','Torrox Costa','nucleo'),
  ('torrox','Torrox Pueblo','nucleo'),
  ('nerja','Maro','nucleo'),
  ('rincon-de-la-victoria','La Cala del Moral','nucleo'),
  ('rincon-de-la-victoria','Torre de Benagalbón','nucleo'),
  ('rincon-de-la-victoria','Benagalbón','nucleo'),
  ('rincon-de-la-victoria','Añoreta','nucleo'),
  ('malaga','Ciudad de Málaga','apodo'),
  ('malaga','Málaga capital','apodo'),
  ('malaga','Málaga ciudad','apodo'),
  ('malaga','El Palo','barrio'),
  ('malaga','Pedregalejo','barrio'),
  ('malaga','Churriana','barrio'),
  ('malaga','Campanillas','barrio'),
  ('malaga','Puerto de la Torre','barrio'),
  ('estepona','Cancelada','nucleo'),
  ('estepona','El Padrón','nucleo'),
  ('casares','Casares Costa','nucleo'),
  ('fuengirola','Los Boliches','nucleo'),
  ('cartama','Estación de Cártama','nucleo'),
  ('cartama','Cártama Estación','nucleo'),
  ('alhaurin-de-la-torre','El Peñón','nucleo'),
  ('algarrobo','Algarrobo Costa','nucleo'),
  ('algarrobo','Mezquitilla','nucleo'),
  ('antequera','Bobadilla','pedania'),
  ('antequera','Bobadilla Estación','pedania'),
  ('antequera','Cartaojal','pedania'),
  ('antequera','La Joya','pedania'),
  ('alora','Bda. El Chorro','pedania'),
  ('alora','El Chorro','pedania'),
  ('ronda','Los Prados','barrio'),
  ('velez-malaga','Vélez Málaga','apodo'),
  ('rincon-de-la-victoria','Rincón','apodo')
) AS v(m_slug, alias, alias_type) ON m.slug = v.m_slug
ON CONFLICT (alias_normalized) DO NOTHING;
