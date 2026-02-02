-- Add is_featured column to venues for filtering main venues in Salas
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add venue_type column to classify venues as 'theater' or 'hall'
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS venue_type text DEFAULT 'hall';

-- Update the canonical theaters list (exactly as specified)
UPDATE public.venues SET venue_type = 'theater', is_featured = true 
WHERE normalized_name IN (
  'teatro-del-soho-caixabank',
  'teatro-del-soho',
  'teatro-soho',
  'teatro-cervantes',
  'teatro-echegaray',
  'auditorio-municipal-de-malaga',
  'teatro-canovas',
  'centro-de-arte-y-creacion-joven',
  'auditorio-edgar-neville',
  'auditorio-eduardo-ocon',
  'escuela-superior-de-arte-dramatico-de-malaga',
  'sala-maria-cristina',
  'teatro-romano-de-malaga'
) OR name ILIKE '%teatro cervantes%'
  OR name ILIKE '%teatro echegaray%'
  OR name ILIKE '%teatro del soho%'
  OR name ILIKE '%auditorio municipal%'
  OR name ILIKE '%teatro cánovas%'
  OR name ILIKE '%teatro canovas%'
  OR name ILIKE '%centro de arte y creación joven%'
  OR name ILIKE '%auditorio edgar neville%'
  OR name ILIKE '%auditorio eduardo ocón%'
  OR name ILIKE '%escuela superior de arte dramático%'
  OR name ILIKE '%sala maría cristina%'
  OR name ILIKE '%teatro romano%';

-- Mark main "Salas" in Málaga city as featured
UPDATE public.venues SET is_featured = true, venue_type = 'hall'
WHERE (
  normalized_name IN (
    'la-cochera-cabaret',
    'sala-paris-15',
    'paris-15',
    'sala-trinchera',
    'sala-marte',
    'eventual',
    'antojo',
    'sala-unicaja-de-conciertos-maria-cristina',
    'polo-de-contenidos-digitales'
  )
  OR name ILIKE '%la cochera cabaret%'
  OR name ILIKE '%paris 15%'
  OR name ILIKE '%parís 15%'
  OR name ILIKE '%sala trinchera%'
  OR name ILIKE '%sala marte%'
  OR name ILIKE '%eventual%'
  OR name ILIKE '%antojo%'
  OR name ILIKE '%polo de contenidos%'
) AND venue_type = 'hall';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_venues_featured ON public.venues(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_venues_type ON public.venues(venue_type);