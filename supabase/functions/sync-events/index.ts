import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// SOURCE ADAPTERS - Each source has its own configuration and parsing logic
// ============================================================================

interface SourceAdapter {
  name: string;
  slug: string;
  url: string;
  programUrl?: string; // Some sites have a separate programming page
  category: string;
  eventType: string;
  defaultVenue: string;
  defaultLocation: string;
  extractionPrompt: string;
}

const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    name: 'Teatro del Soho CaixaBank',
    slug: 'teatro-soho',
    url: 'https://teatrodelsoho.com/',
    programUrl: 'https://teatrodelsoho.com/programacion/',
    category: 'theater',
    eventType: 'theater',
    defaultVenue: 'Teatro del Soho CaixaBank',
    defaultLocation: 'Málaga',
    extractionPrompt: `IMPORTANTE: Extrae TODOS los espectáculos/obras de teatro de esta página de programación.
Para CADA espectáculo, proporciona:
- title: nombre exacto del espectáculo (ej: "El médico", "Nine", "Malinche")
- description: sinopsis o descripción breve (máximo 400 caracteres)
- occurrences: LISTA de TODAS las fechas y horas de funciones. Si hay un rango "del 15 al 30 de enero", convierte a fechas individuales. Formatos aceptados: DD/MM/YYYY para fecha, HH:MM para hora.
- image_url: URL completa del cartel/imagen principal del espectáculo
- ticket_url: enlace para comprar entradas
- price: precio de las entradas si aparece
- venue: "Teatro del Soho CaixaBank" siempre
- is_free: false (casi todos son de pago)

CRÍTICO: Captura CADA función individual con su fecha y hora. Un espectáculo puede tener múltiples funciones.`,
  },
  {
    name: 'Teatro Cervantes',
    slug: 'teatro-cervantes',
    url: 'https://www.teatrocervantes.com/',
    programUrl: 'https://www.teatrocervantes.com/es/programacion',
    category: 'theater',
    eventType: 'theater',
    defaultVenue: 'Teatro Cervantes',
    defaultLocation: 'Málaga',
    extractionPrompt: `IMPORTANTE: Extrae TODOS los eventos de la programación del Teatro Cervantes y Teatro Echegaray.
Para CADA evento (teatro, danza, música, circo, etc.):
- title: nombre exacto del espectáculo
- description: descripción breve (máximo 400 caracteres)
- occurrences: TODAS las fechas y horas de las funciones. Convierte rangos a fechas individuales.
- venue: especifica si es "Teatro Cervantes" o "Teatro Echegaray"
- image_url: cartel o imagen del evento
- ticket_url: enlace de venta de entradas
- price: precios disponibles
- is_free: true solo si es entrada gratuita

CRÍTICO: Cada función en una fecha diferente debe ser una occurrence separada.`,
  },
  {
    name: 'Sala Eventual',
    slug: 'eventual-music',
    url: 'https://www.eventualmusic.com/',
    programUrl: 'https://www.eventualmusic.com/agenda',
    category: 'music',
    eventType: 'music',
    defaultVenue: 'Sala Eventual',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extrae TODOS los conciertos y eventos musicales de la agenda.
Para CADA concierto:
- title: nombre del artista/banda + título del evento si existe
- description: información del concierto (máximo 400 caracteres)
- occurrences: fecha y hora del concierto (formato DD/MM/YYYY y HH:MM)
- image_url: flyer o imagen promocional del evento
- ticket_url: enlace para comprar entradas
- price: precio de la entrada
- is_free: true solo si es entrada libre

Incluye todos los géneros: rock, indie, electrónica, jazz, etc.`,
  },
  {
    name: 'Sala Trinchera',
    slug: 'sala-trinchera',
    url: 'https://salatrinchera.com/',
    programUrl: 'https://salatrinchera.com/agenda/',
    category: 'music',
    eventType: 'music',
    defaultVenue: 'Sala Trinchera',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extrae TODOS los eventos y conciertos de la agenda de Sala Trinchera.
Para CADA evento:
- title: nombre del artista/evento
- description: información del evento (máximo 400 caracteres)
- occurrences: fecha y hora (DD/MM/YYYY, HH:MM)
- image_url: cartel o flyer del evento
- ticket_url: link de entradas
- price: precio
- is_free: si es entrada gratuita

Captura conciertos, fiestas, jam sessions, etc.`,
  },
  {
    name: 'París 15',
    slug: 'paris-15',
    url: 'https://paris15.es/',
    programUrl: 'https://paris15.es/agenda/',
    category: 'nightlife',
    eventType: 'nightlife',
    defaultVenue: 'París 15',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extrae TODOS los eventos, fiestas y conciertos de París 15.
Para CADA evento:
- title: nombre del evento o artista
- description: descripción del evento (máximo 400 caracteres)
- occurrences: fecha y hora del evento (DD/MM/YYYY, HH:MM)
- image_url: cartel promocional
- ticket_url: enlace de entradas si existe
- price: precio de entrada
- is_free: si es entrada libre

Incluye DJ sets, fiestas temáticas, conciertos, etc.`,
  },
  {
    name: 'Sala Marte',
    slug: 'sala-marte',
    url: 'https://salamartemalaga.com/',
    programUrl: 'https://salamartemalaga.com/agenda/',
    category: 'music',
    eventType: 'music',
    defaultVenue: 'Sala Marte',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extrae TODOS los conciertos y eventos de Sala Marte.
Para CADA evento:
- title: nombre del artista/banda
- description: información del concierto (máximo 400 caracteres)
- occurrences: fecha y hora (DD/MM/YYYY, HH:MM)
- image_url: flyer del concierto
- ticket_url: link de venta
- price: precio de entrada
- is_free: true si entrada gratuita

Captura todos los estilos musicales.`,
  },
  {
    name: 'Antojo Málaga',
    slug: 'antojo-malaga',
    url: 'https://antojomalaga.es/',
    programUrl: 'https://antojomalaga.es/eventos/',
    category: 'music',
    eventType: 'music',
    defaultVenue: 'Antojo Málaga',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extrae TODOS los eventos de Antojo Málaga.
Para CADA evento:
- title: nombre del evento o artista
- description: descripción (máximo 400 caracteres)
- occurrences: fecha y hora (DD/MM/YYYY, HH:MM)
- image_url: imagen del evento
- ticket_url: enlace de entradas
- price: precio
- is_free: si es gratuito

Incluye conciertos, DJ sessions, eventos gastronómicos con música, etc.`,
  },
];

// ============================================================================
// VENUE AND LOCATION NORMALIZATION
// ============================================================================

const VENUE_ALIASES: Record<string, string> = {
  'teatro del soho': 'Teatro del Soho CaixaBank',
  'teatro soho': 'Teatro del Soho CaixaBank',
  'soho caixabank': 'Teatro del Soho CaixaBank',
  'soho': 'Teatro del Soho CaixaBank',
  'teatro cervantes': 'Teatro Cervantes',
  'cervantes': 'Teatro Cervantes',
  'teatro echegaray': 'Teatro Echegaray',
  'echegaray': 'Teatro Echegaray',
  'sala trinchera': 'Sala Trinchera',
  'trinchera': 'Sala Trinchera',
  'la trinchera': 'Sala Trinchera',
  'cochera cabaret': 'Cochera Cabaret',
  'la cochera cabaret': 'Cochera Cabaret',
  'cochera': 'Cochera Cabaret',
  'paris 15': 'París 15',
  'parís 15': 'París 15',
  'paris15': 'París 15',
  'sala eventual': 'Sala Eventual',
  'eventual': 'Sala Eventual',
  'eventual music': 'Sala Eventual',
  'sala marte': 'Sala Marte',
  'marte': 'Sala Marte',
  'antojo': 'Antojo Málaga',
  'antojo malaga': 'Antojo Málaga',
  'antojo málaga': 'Antojo Málaga',
  'la termica': 'La Térmica',
  'la térmica': 'La Térmica',
};

const MALAGA_MUNICIPALITIES = [
  'Málaga', 'Torremolinos', 'Benalmádena', 'Fuengirola', 'Marbella', 'Estepona',
  'Rincón de la Victoria', 'Vélez-Málaga', 'Antequera', 'Ronda', 'Nerja', 'Mijas',
  'Alhaurín de la Torre', 'Alhaurín el Grande', 'Coín', 'Cártama', 'Manilva',
];

// ============================================================================
// EXTRACTION SCHEMA FOR FIRECRAWL
// ============================================================================

const EVENT_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Nombre del evento/espectáculo' },
          description: { type: 'string', description: 'Descripción breve (max 400 chars)' },
          occurrences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Fecha en formato DD/MM/YYYY' },
                time: { type: 'string', description: 'Hora en formato HH:MM' },
                end_time: { type: 'string', description: 'Hora fin si disponible' },
              },
              required: ['date'],
            },
            description: 'Todas las fechas/horas cuando ocurre el evento',
          },
          venue: { type: 'string', description: 'Nombre del venue/sala' },
          city: { type: 'string', description: 'Ciudad/municipio' },
          image_url: { type: 'string', description: 'URL de la imagen principal' },
          ticket_url: { type: 'string', description: 'URL para comprar entradas' },
          price: { type: 'string', description: 'Precio de las entradas' },
          is_free: { type: 'boolean', description: 'Si es entrada gratuita' },
        },
        required: ['title'],
      },
    },
  },
  required: ['events'],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function normalizeVenue(venueRaw: string, defaultVenue: string): string {
  if (!venueRaw) return defaultVenue;
  const lower = venueRaw.toLowerCase().trim();
  return VENUE_ALIASES[lower] || defaultVenue;
}

function parseSpanishDate(dateText: string, timeText?: string): Date | null {
  if (!dateText) return null;
  
  const months: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
  };
  
  let hour = 20, minute = 0;
  
  if (timeText) {
    const timeMatch = timeText.match(/(\d{1,2})[:\.](\d{2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = parseInt(timeMatch[2]);
    }
  }
  
  // Spanish format: "15 de enero de 2025" or "15 enero 2025"
  const spanishMatch = dateText.match(/(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+(?:de\s+)?(\d{4}))?/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1]);
    const monthStr = spanishMatch[2].toLowerCase();
    const month = months[monthStr];
    if (!isNaN(day) && month !== undefined) {
      let year = spanishMatch[3] ? parseInt(spanishMatch[3]) : new Date().getFullYear();
      const date = new Date(year, month, day, hour, minute);
      // If date is in the past and no year specified, assume next year
      if (date < new Date() && !spanishMatch[3]) {
        date.setFullYear(year + 1);
      }
      return date;
    }
  }
  
  // Numeric: "15/01/2025" or "15-01-2025" or "15.01.2025"
  const numericMatch = dateText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    let year = parseInt(numericMatch[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day, hour, minute);
    return date;
  }
  
  // ISO: "2025-01-15"
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), hour, minute);
  }
  
  return null;
}

function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function isValidEventTitle(title: string): boolean {
  if (!title || title.length < 3 || title.length > 200) return false;
  
  const invalidPatterns = [
    /^(menu|menú|inicio|home|contacto|contact|about|cookies|privacidad|legal|newsletter)/i,
    /^(ver más|leer más|read more|see more|siguiente|anterior|next|prev)/i,
    /^(aceptar|rechazar|cerrar|close|accept|reject|ok|cancel)/i,
    /^(agenda|programación|programa|calendar|eventos|events)$/i,
    /^(facebook|twitter|instagram|youtube|linkedin|tiktok)/i,
    /^(reservar|comprar|buy|book|tickets|entradas)$/i,
    /^\d+$/,
    /^[^a-záéíóúñ]+$/i,
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(title)) return false;
  }
  
  return true;
}

function normalizeImageUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  
  // Skip logos, icons, and very small likely placeholder images
  if (/logo|icon|favicon|placeholder|default|avatar/i.test(url)) return undefined;
  
  // Skip data URIs that are likely placeholders
  if (url.startsWith('data:')) return undefined;
  
  // Make absolute
  try {
    if (url.startsWith('//')) {
      url = 'https:' + url;
    } else if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      url = base.origin + url;
    } else if (!url.startsWith('http')) {
      const base = new URL(baseUrl);
      url = base.origin + '/' + url;
    }
    
    // Force HTTPS
    url = url.replace(/^http:/, 'https:');
    
    // Validate URL
    new URL(url);
    return url;
  } catch {
    return undefined;
  }
}

function generateDedupeKey(sourceSlug: string, title: string, venue: string): string {
  const normalized = `${sourceSlug}|${normalizeText(title)}|${normalizeText(venue)}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${sourceSlug}_${Math.abs(hash).toString(36)}`;
}

function determineEventType(title: string, description: string, sourceEventType: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  // Check for specific keywords
  if (/comedia|comedy|monólogo|humor|stand.?up|risas/i.test(text)) return 'comedy';
  if (/festival/i.test(text)) return 'festival';
  if (/teatro|theatre|obra|musical|danza|dance|circo|circus/i.test(text)) return 'theater';
  if (/dj|disco|fiesta|party|club|noche/i.test(text)) return 'nightlife';
  if (/concierto|concert|música|music|banda|band|live|directo/i.test(text)) return 'music';
  
  // Default to source's event type
  return sourceEventType;
}

// ============================================================================
// SCRAPING WITH FIRECRAWL
// ============================================================================

async function scrapeSource(adapter: SourceAdapter, apiKey: string): Promise<any> {
  // Use program URL if available, otherwise main URL
  const urlToScrape = adapter.programUrl || adapter.url;
  console.log(`Scraping ${adapter.name} from ${urlToScrape}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: urlToScrape,
      formats: ['json'],
      jsonOptions: {
        schema: EVENT_EXTRACTION_SCHEMA,
        prompt: adapter.extractionPrompt,
      },
      onlyMainContent: true,
      waitFor: 8000, // Wait for dynamic content
      timeout: 60000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Firecrawl error for ${adapter.name}:`, errorText);
    throw new Error(`Firecrawl request failed: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  console.log(`Firecrawl response for ${adapter.name}:`, JSON.stringify(result).substring(0, 500));
  return result;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function getOrCreateVenue(supabase: any, venueName: string, city: string): Promise<string | null> {
  const normalized = normalizeText(venueName);
  
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .eq('normalized_name', normalized)
    .maybeSingle();
  
  if (existing) return existing.id;
  
  const { data: created, error } = await supabase
    .from('venues')
    .insert({ 
      name: venueName, 
      normalized_name: normalized, 
      city: city,
      province: 'Málaga',
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating venue:', error);
    return null;
  }
  
  return created.id;
}

async function getOrCreateLocation(supabase: any, locationName: string): Promise<string | null> {
  const normalized = normalizeText(locationName);
  
  const { data: existing } = await supabase
    .from('locations')
    .select('id')
    .eq('normalized_name', normalized)
    .maybeSingle();
  
  if (existing) return existing.id;
  
  const isInMalaga = MALAGA_MUNICIPALITIES.some(m => normalizeText(m) === normalized);
  
  const { data: created, error } = await supabase
    .from('locations')
    .insert({
      name: locationName,
      normalized_name: normalized,
      province: 'Málaga',
      country: 'ES',
      is_in_province_malaga: isInMalaga,
      is_enabled: true,
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating location:', error);
    return null;
  }
  
  return created.id;
}

async function upsertEventWithOccurrences(
  supabase: any,
  adapter: SourceAdapter,
  eventData: any,
  occurrences: Array<{ date: string; time?: string; end_time?: string }>
): Promise<{ inserted: boolean; updated: boolean; occurrences_created: number; skipped: boolean }> {
  const title = cleanTitle(eventData.title);
  if (!title) {
    return { inserted: false, updated: false, occurrences_created: 0, skipped: true };
  }
  
  const venueName = normalizeVenue(eventData.venue || '', adapter.defaultVenue);
  const locationName = eventData.city || adapter.defaultLocation;
  const eventType = determineEventType(title, eventData.description || '', adapter.eventType);
  
  // Get or create venue and location
  const venueId = await getOrCreateVenue(supabase, venueName, locationName);
  const locationId = await getOrCreateLocation(supabase, locationName);
  
  const dedupeKey = generateDedupeKey(adapter.slug, title, venueName);
  
  // Check if event exists by dedupe_key
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();
  
  let eventId: string;
  let isNew = false;
  let isUpdated = false;
  
  const isFree = eventData.is_free === true || 
    (eventData.price && /gratis|free|entrada libre|0\s*€/i.test(eventData.price));
  
  const imageUrl = normalizeImageUrl(eventData.image_url, adapter.url);
  const imageStatus = imageUrl ? 'ok' : 'missing';
  
  const eventPayload = {
    title,
    description: eventData.description?.substring(0, 500) || `Evento en ${venueName}`,
    description_short: eventData.description?.substring(0, 150) || null,
    description_full: eventData.description || null,
    category: adapter.category,
    event_type: eventType,
    source: adapter.slug,
    source_type: 'official_feed',
    source_ref: adapter.programUrl || adapter.url,
    url: adapter.programUrl || adapter.url,
    venue_name: venueName,
    venue_id: venueId,
    venue_name_raw: eventData.venue || null,
    venue_normalized: normalizeText(venueName),
    location_id: locationId,
    location_name_raw: locationName,
    location_normalized: normalizeText(locationName),
    province: 'Málaga',
    country: 'ES',
    image_url: imageUrl,
    image_status: imageStatus,
    buy_url: eventData.ticket_url || null,
    ticket_url: eventData.ticket_url || null,
    is_free: isFree,
    price_info: isFree ? 'Gratis' : (eventData.price || null),
    status: 'published',
    last_synced_at: new Date().toISOString(),
    dedupe_key: dedupeKey,
  };
  
  if (existingEvent) {
    // Update existing
    eventId = existingEvent.id;
    await supabase
      .from('events')
      .update(eventPayload)
      .eq('id', eventId);
    isUpdated = true;
  } else {
    // Insert new
    const firstOccurrence = occurrences[0];
    const startAt = parseSpanishDate(firstOccurrence?.date || '', firstOccurrence?.time);
    
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert({
        ...eventPayload,
        start_at: startAt?.toISOString() || new Date().toISOString(),
        address: `${venueName}, ${locationName}`,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error inserting event:', error.message);
      return { inserted: false, updated: false, occurrences_created: 0, skipped: true };
    }
    
    eventId = newEvent.id;
    isNew = true;
  }
  
  // Upsert occurrences
  let occurrencesCreated = 0;
  const now = new Date();
  
  for (const occ of occurrences) {
    const startDatetime = parseSpanishDate(occ.date, occ.time);
    if (!startDatetime) continue;
    
    // Skip past occurrences
    if (startDatetime < now) continue;
    
    const endDatetime = occ.end_time ? parseSpanishDate(occ.date, occ.end_time) : null;
    
    // Check if occurrence exists
    const { data: existingOcc } = await supabase
      .from('event_occurrences')
      .select('id')
      .eq('event_id', eventId)
      .eq('start_datetime', startDatetime.toISOString())
      .maybeSingle();
    
    if (!existingOcc) {
      const { error: occError } = await supabase
        .from('event_occurrences')
        .insert({
          event_id: eventId,
          start_datetime: startDatetime.toISOString(),
          end_datetime: endDatetime?.toISOString() || null,
          buy_url: eventData.ticket_url || null,
        });
      
      if (!occError) {
        occurrencesCreated++;
      }
    }
  }
  
  // Update event's start_at to the next upcoming occurrence
  const { data: nextOcc } = await supabase
    .from('event_occurrences')
    .select('start_datetime')
    .eq('event_id', eventId)
    .gte('start_datetime', now.toISOString())
    .order('start_datetime', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (nextOcc) {
    await supabase
      .from('events')
      .update({ start_at: nextOcc.start_datetime })
      .eq('id', eventId);
  }
  
  return { inserted: isNew, updated: isUpdated, occurrences_created: occurrencesCreated, skipped: false };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured. Please add FIRECRAWL_API_KEY secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional source filter
    let targetSources: string[] | null = null;
    try {
      const body = await req.json();
      if (body.sources && Array.isArray(body.sources)) {
        targetSources = body.sources;
      }
    } catch {
      // No body or invalid JSON - run all sources
    }

    const adaptersToRun = targetSources 
      ? SOURCE_ADAPTERS.filter(a => targetSources!.includes(a.slug))
      : SOURCE_ADAPTERS;

    console.log(`=== STARTING FULL SYNC ===`);
    console.log(`Sources to process: ${adaptersToRun.map(a => a.name).join(', ')}`);

    const results = {
      sources_processed: 0,
      sources_success: 0,
      sources_failed: 0,
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      events_skipped: 0,
      occurrences_created: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const adapter of adaptersToRun) {
      console.log(`\n--- Processing: ${adapter.name} ---`);
      
      // Create sync run record
      const { data: syncRun } = await supabase
        .from('sync_runs')
        .insert({ source: adapter.slug, status: 'running' })
        .select('id')
        .single();

      const sourceResults = {
        source: adapter.name,
        slug: adapter.slug,
        inserted: 0,
        updated: 0,
        skipped: 0,
        occurrences: 0,
        eventsFound: 0,
        error: null as string | null,
      };

      try {
        const scrapeResult = await scrapeSource(adapter, firecrawlApiKey);
        results.sources_processed++;
        
        // Extract events from response - handle different response structures
        let events: any[] = [];
        
        if (scrapeResult.success && scrapeResult.data) {
          // Check for json property (Firecrawl v1 structure)
          if (scrapeResult.data.json?.events) {
            events = scrapeResult.data.json.events;
          } else if (scrapeResult.data.events) {
            events = scrapeResult.data.events;
          } else if (Array.isArray(scrapeResult.data)) {
            events = scrapeResult.data;
          }
        } else if (scrapeResult.events) {
          events = scrapeResult.events;
        }
        
        // Filter valid events
        events = events.filter((e: any) => e.title && isValidEventTitle(e.title));
        
        sourceResults.eventsFound = events.length;
        results.events_found += events.length;
        
        console.log(`Found ${events.length} valid events from ${adapter.name}`);
        
        if (events.length === 0) {
          sourceResults.error = 'No valid events extracted';
          results.errors.push(`${adapter.name}: No events found`);
        }
        
        for (const event of events) {
          // Build occurrences array
          let occurrences = event.occurrences || [];
          
          // If no occurrences but has date field, create single occurrence
          if (occurrences.length === 0 && event.date) {
            occurrences = [{ date: event.date, time: event.time }];
          }
          
          // If still no occurrences, skip this event (we need at least one date)
          if (occurrences.length === 0) {
            console.log(`Skipping event without dates: ${event.title}`);
            sourceResults.skipped++;
            continue;
          }
          
          const result = await upsertEventWithOccurrences(
            supabase,
            adapter,
            event,
            occurrences
          );
          
          if (result.skipped) {
            sourceResults.skipped++;
            results.events_skipped++;
          } else if (result.inserted) {
            sourceResults.inserted++;
            results.events_inserted++;
          } else if (result.updated) {
            sourceResults.updated++;
            results.events_updated++;
          }
          
          sourceResults.occurrences += result.occurrences_created;
          results.occurrences_created += result.occurrences_created;
        }
        
        results.sources_success++;
        
        // Update sync run
        if (syncRun?.id) {
          await supabase
            .from('sync_runs')
            .update({
              status: 'completed',
              finished_at: new Date().toISOString(),
              inserted: sourceResults.inserted,
              updated: sourceResults.updated,
              skipped: sourceResults.skipped,
              occurrences_created: sourceResults.occurrences,
            })
            .eq('id', syncRun.id);
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${adapter.name}:`, errorMsg);
        sourceResults.error = errorMsg;
        results.errors.push(`${adapter.name}: ${errorMsg}`);
        results.sources_failed++;
        
        if (syncRun?.id) {
          await supabase
            .from('sync_runs')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              errors: 1,
              error_details: { message: errorMsg },
            })
            .eq('id', syncRun.id);
        }
      }
      
      results.details.push(sourceResults);
      
      // Rate limiting delay between sources
      if (adaptersToRun.indexOf(adapter) < adaptersToRun.length - 1) {
        console.log('Waiting 3 seconds before next source...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(`\n=== SYNC COMPLETED ===`);
    console.log(`Sources: ${results.sources_success}/${results.sources_processed} successful`);
    console.log(`Events: ${results.events_inserted} new, ${results.events_updated} updated, ${results.events_skipped} skipped`);
    console.log(`Occurrences created: ${results.occurrences_created}`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-events:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
