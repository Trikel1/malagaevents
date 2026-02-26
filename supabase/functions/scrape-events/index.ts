import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official Málaga event sources - now with location info
const EVENT_SOURCES = [
  { name: 'Agenda Municipal Málaga', url: 'https://www.malaga.eu/la-ciudad/agenda/', category: 'other', defaultLocation: 'Málaga' },
  { name: 'Teatro Cervantes', url: 'https://www.teatrocervantes.es/programacion/', category: 'theater', defaultLocation: 'Málaga', defaultVenue: 'Teatro Cervantes' },
  { name: 'CAC Málaga', url: 'https://cacmalaga.eu/exposiciones/', category: 'exhibitions', defaultLocation: 'Málaga', defaultVenue: 'CAC Málaga' },
  { name: 'La Térmica', url: 'https://www.latermicamalaga.com/agenda/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'La Térmica' },
  { name: 'Museo Picasso Málaga', url: 'https://www.museopicassomalaga.org/actividades', category: 'exhibitions', defaultLocation: 'Málaga', defaultVenue: 'Museo Picasso Málaga' },
  { name: 'Centre Pompidou Málaga', url: 'https://centrepompidou-malaga.eu/actividades/', category: 'exhibitions', defaultLocation: 'Málaga', defaultVenue: 'Centre Pompidou' },
  { name: 'Diputación de Málaga Cultura', url: 'https://www.malaga.es/cultura/agenda/', category: 'other', defaultLocation: 'Málaga' },
  { name: 'Más Málaga', url: 'https://mmalaga.es/agenda/', category: 'other', defaultLocation: 'Málaga' },
  { name: 'Más Málaga Conciertos', url: 'https://mmalaga.es/conciertos-malaga/', category: 'music', defaultLocation: 'Málaga' },
  { name: 'Más Málaga Teatro', url: 'https://mmalaga.es/teatro-malaga/', category: 'theater', defaultLocation: 'Málaga' },
  { name: 'Teatro Echegaray', url: 'https://www.teatroechegaray.es/programacion/', category: 'theater', defaultLocation: 'Málaga', defaultVenue: 'Teatro Echegaray' },
  { name: 'Fundación Unicaja', url: 'https://fundacionunicaja.com/agenda/', category: 'exhibitions', defaultLocation: 'Málaga' },
  { name: 'La Garrapata', url: 'https://www.instagram.com/barlagarrapata/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'La Garrapata' },
  { name: 'Sala Trinchera', url: 'https://salatrinchera.com/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'Sala Trinchera' },
  { name: 'Paris 15', url: 'https://paris15.es/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'París 15' },
  { name: 'Sala Marte Málaga', url: 'https://salamartemalaga.com/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'Sala Marte' },
  { name: 'Antojo Málaga', url: 'https://antojomalaga.es/', category: 'music', defaultLocation: 'Málaga' },
  { name: 'Cochera Cabaret', url: 'https://www.cocheracabaret.com/', category: 'music', defaultLocation: 'Málaga', defaultVenue: 'Cochera Cabaret' },
];

// Venue normalization mapping
const VENUE_ALIASES: Record<string, string> = {
  'sala trinchera': 'Sala Trinchera',
  'trinchera': 'Sala Trinchera',
  'la trinchera': 'Sala Trinchera',
  'cochera cabaret': 'Cochera Cabaret',
  'la cochera cabaret': 'Cochera Cabaret',
  'cochera': 'Cochera Cabaret',
  'la cochera': 'Cochera Cabaret',
  'paris 15': 'París 15',
  'parís 15': 'París 15',
  'paris15': 'París 15',
  'paris-15': 'París 15',
  'la garrapata': 'La Garrapata',
  'bar la garrapata': 'La Garrapata',
  'garrapata': 'La Garrapata',
  'sala marte': 'Sala Marte',
  'marte': 'Sala Marte',
  'marte malaga': 'Sala Marte',
  'sala marte málaga': 'Sala Marte',
};

// Málaga province municipalities for location detection
const MALAGA_MUNICIPALITIES = [
  'Málaga', 'Torremolinos', 'Benalmádena', 'Fuengirola', 'Marbella', 'Estepona',
  'Rincón de la Victoria', 'Vélez-Málaga', 'Antequera', 'Ronda', 'Nerja', 'Mijas',
  'Alhaurín de la Torre', 'Alhaurín el Grande', 'Coín', 'Cártama', 'Manilva',
  'Casares', 'Benahavís', 'Ojén', 'Monda', 'Guaro', 'Tolox', 'Álora', 'Pizarra',
  'Alozaina', 'Yunquera', 'El Burgo', 'Casarabonela', 'Ardales', 'Carratraca',
  'Almogía', 'Colmenar', 'Comares', 'Riogordo', 'Periana', 'Alcaucín', 'Canillas de Aceituno',
  'Frigiliana', 'Torrox', 'Algarrobo', 'Arenas', 'Sayalonga', 'Cómpeta',
  'Archidona', 'Villanueva del Trabuco', 'Villanueva de Algaidas', 'Cuevas Bajas',
  'Cuevas de San Marcos', 'Villanueva de Tapia', 'Villanueva del Rosario',
  'Campillos', 'Teba', 'Sierra de Yeguas', 'Alameda', 'Mollina', 'Humilladero',
  'Fuente de Piedra', 'Villanueva de la Concepción', 'Valle de Abdalajís',
];

// JSON schema for structured event extraction
const EVENT_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The name/title of the event' },
          description: { type: 'string', description: 'A brief description of the event (max 500 chars)' },
          date: { type: 'string', description: 'The date of the event in format DD/MM/YYYY or descriptive like "15 de enero de 2025"' },
          time: { type: 'string', description: 'The start time of the event like "20:00" or "8pm"' },
          venue: { type: 'string', description: 'The venue or location name where the event takes place' },
          city: { type: 'string', description: 'The city or town where the event takes place (e.g., Málaga, Marbella, Torremolinos)' },
          address: { type: 'string', description: 'The street address of the venue' },
          price: { type: 'string', description: 'The ticket price or "Gratis" if free' },
          image_url: { type: 'string', description: 'URL of the event image or poster' },
          ticket_url: { type: 'string', description: 'URL to buy tickets' },
          is_free: { type: 'boolean', description: 'Whether the event is free' },
        },
        required: ['title'],
      },
    },
  },
  required: ['events'],
};

interface ExtractedEvent {
  title: string;
  description?: string;
  date?: string;
  time?: string;
  venue?: string;
  city?: string;
  address?: string;
  price?: string;
  image_url?: string;
  ticket_url?: string;
  is_free?: boolean;
}

interface SourceConfig {
  name: string;
  url: string;
  category: string;
  defaultLocation?: string;
  defaultVenue?: string;
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<any> {
  console.log(`Scraping URL: ${url}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'json'],
      jsonOptions: {
        schema: EVENT_EXTRACTION_SCHEMA,
        prompt: 'Extract all upcoming cultural events from this page. For each event get: title, description, date (in DD/MM/YYYY format), time (in HH:MM format), venue name, city/town name (e.g., Málaga, Marbella), address, price, image URL, ticket URL, and whether it is free.',
      },
      onlyMainContent: true,
      waitFor: 3000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Firecrawl error for ${url}:`, error);
    throw new Error(`Firecrawl request failed: ${response.status}`);
  }

  return response.json();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function normalizeVenue(venueRaw: string): { normalized: string; canonical: string } {
  const lower = venueRaw.toLowerCase().trim();
  const canonical = VENUE_ALIASES[lower] || null;
  const normalized = normalizeText(venueRaw);
  
  return {
    normalized,
    canonical: canonical || venueRaw.trim(),
  };
}

function detectLocation(text: string, defaultLocation: string): string {
  const lower = text.toLowerCase();
  
  for (const municipality of MALAGA_MUNICIPALITIES) {
    const normalized = normalizeText(municipality);
    if (lower.includes(municipality.toLowerCase()) || lower.includes(normalized)) {
      return municipality;
    }
  }
  
  // Check for Costa del Sol generic
  if (/costa\s*(del)?\s*sol/i.test(text)) {
    return 'Costa del Sol';
  }
  
  return defaultLocation;
}

function parseSpanishDate(dateText: string, timeText?: string): Date | null {
  if (!dateText) return null;
  
  const months: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  };
  
  let hour = 20, minute = 0;
  
  if (timeText) {
    const timeMatch = timeText.match(/(\d{1,2})[:\.]?(\d{2})?/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (timeText.toLowerCase().includes('pm') && hour < 12) hour += 12;
    }
  }
  
  // Spanish format
  const spanishMatch = dateText.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1]);
    const monthStr = spanishMatch[2].toLowerCase();
    const month = months[monthStr];
    if (!isNaN(day) && month !== undefined) {
      let year = spanishMatch[3] ? parseInt(spanishMatch[3]) : new Date().getFullYear();
      const date = new Date(year, month, day, hour, minute);
      if (date < new Date() && !spanishMatch[3]) {
        date.setFullYear(year + 1);
      }
      return date;
    }
  }
  
  // Numeric format
  const numericMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    let year = parseInt(numericMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day, hour, minute);
  }
  
  // ISO format
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]) - 1;
    const day = parseInt(isoMatch[3]);
    return new Date(year, month, day, hour, minute);
  }
  
  return null;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function isValidEventTitle(title: string): boolean {
  if (!title || title.length < 4 || title.length > 200) return false;
  
  const invalidPatterns = [
    /^(menu|inicio|home|contacto|about|cookies|privacidad|legal|newsletter)/i,
    /^(ver más|leer más|read more|see more|siguiente|anterior)/i,
    /^(aceptar|rechazar|cerrar|close|accept|reject)/i,
    /^(agenda|programación|programa|calendar|eventos)$/i,
    /^(facebook|twitter|instagram|youtube|linkedin)/i,
    /^\d+$/,
    /^[^a-záéíóúñ]+$/i,
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(title)) return false;
  }
  
  return true;
}

function generateDedupeKey(title: string, startAt: string, venueNormalized: string, locationNormalized: string, url: string): string {
  const combined = `${title}|${startAt}|${venueNormalized}|${locationNormalized}|${url}`;
  // Simple hash - in production use a proper hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `dedupe_${Math.abs(hash).toString(36)}`;
}

async function getOrCreateVenue(supabase: any, venueRaw: string, city?: string): Promise<{ id: string; name: string } | null> {
  if (!venueRaw) return null;
  
  const { normalized, canonical } = normalizeVenue(venueRaw);
  
  // Try to find existing venue
  const { data: existing } = await supabase
    .from('venues')
    .select('id, name')
    .eq('normalized_name', normalizeText(canonical))
    .maybeSingle();
  
  if (existing) return existing;
  
  // Create new venue
  const { data: created, error } = await supabase
    .from('venues')
    .insert({
      name: canonical,
      normalized_name: normalizeText(canonical),
      city: city || null,
    })
    .select('id, name')
    .single();
  
  if (error) {
    console.error('Error creating venue:', error);
    return null;
  }
  
  return created;
}

async function getOrCreateLocation(supabase: any, locationName: string): Promise<{ id: string; name: string } | null> {
  if (!locationName) return null;
  
  const normalized = normalizeText(locationName);
  
  // Try to find existing location
  const { data: existing } = await supabase
    .from('locations')
    .select('id, name')
    .eq('normalized_name', normalized)
    .maybeSingle();
  
  if (existing) return existing;
  
  // Check if it's in Málaga province
  const isInMalaga = MALAGA_MUNICIPALITIES.some(m => 
    normalizeText(m) === normalized || m.toLowerCase() === locationName.toLowerCase()
  );
  
  // Create new location
  const { data: created, error } = await supabase
    .from('locations')
    .insert({
      name: locationName,
      normalized_name: normalized,
      province: 'Málaga',
      country: 'ES',
      is_in_province_malaga: isInMalaga,
      is_enabled: true,
      needs_review: !isInMalaga,
    })
    .select('id, name')
    .single();
  
  if (error) {
    console.error('Error creating location:', error);
    return null;
  }
  
  return created;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting event scraping with venue/location normalization...');
    
    // Create sync run record
    const { data: syncRun } = await supabase
      .from('sync_runs')
      .insert({
        source: 'all_sources',
        status: 'running',
      })
      .select('id')
      .single();
    
    const results = {
      sources_scraped: 0,
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      events_skipped: 0,
      errors: [] as string[],
    };

    for (const source of EVENT_SOURCES) {
      try {
        console.log(`Processing source: ${source.name}`);
        
        const scrapeResult = await scrapeWithFirecrawl(source.url, firecrawlApiKey);
        results.sources_scraped++;
        
        if (!scrapeResult.success) {
          console.log(`Scrape failed for ${source.name}`);
          results.errors.push(`${source.name}: Scrape failed`);
          continue;
        }
        
        let events: ExtractedEvent[] = [];
        
        if (scrapeResult.data?.json?.events) {
          events = scrapeResult.data.json.events;
          console.log(`JSON extraction found ${events.length} events from ${source.name}`);
        }
        
        const validEvents = events.filter(e => e.title && isValidEventTitle(e.title));
        results.events_found += validEvents.length;
        
        console.log(`${validEvents.length} valid events from ${source.name}`);
        
        for (const event of validEvents) {
          const cleanedTitle = cleanTitle(event.title);
          
          // Detect/normalize venue
          const venueRaw = event.venue || source.defaultVenue || source.name;
          const { normalized: venueNormalized, canonical: venueCanonical } = normalizeVenue(venueRaw);
          
          // Detect/normalize location
          const locationRaw = event.city || detectLocation(event.address || event.venue || '', source.defaultLocation || 'Málaga');
          const locationNormalized = normalizeText(locationRaw);
          
          // Parse date
          let startAt = parseSpanishDate(event.date || '', event.time);
          if (!startAt) {
            startAt = new Date();
            startAt.setDate(startAt.getDate() + 7);
            startAt.setHours(20, 0, 0, 0);
          }
          
          // Skip old events
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          if (startAt < oneMonthAgo) {
            results.events_skipped++;
            continue;
          }
          
          // Generate dedupe key
          const dedupeKey = generateDedupeKey(
            cleanedTitle,
            startAt.toISOString(),
            venueNormalized,
            locationNormalized,
            source.url
          );
          
          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .maybeSingle();
          
          if (existing) {
            results.events_skipped++;
            continue;
          }
          
          // Get or create venue
          const venue = await getOrCreateVenue(supabase, venueCanonical, locationRaw);
          
          // Get or create location
          const location = await getOrCreateLocation(supabase, locationRaw);
          
          // Determine if free
          const isFree = event.is_free || 
            (event.price && /gratis|free|entrada libre|0\s*€/i.test(event.price)) ||
            false;
          
          let priceInfo = event.price;
          if (isFree) priceInfo = 'Gratis';
          
          // Insert the event with all new fields
          const { error: insertError } = await supabase
            .from('events')
            .insert({
              title: cleanedTitle,
              description: event.description?.substring(0, 1000) || `Evento en ${venueCanonical}`,
              category: source.category,
              start_at: startAt.toISOString(),
              venue_name: venueCanonical,
              address: event.address || `${venueCanonical}, ${locationRaw}`,
              source_type: 'official_feed',
              source_ref: source.url,
              source: source.name,
              url: source.url,
              status: 'published',
              is_free: isFree,
              price_info: priceInfo,
              image_url: event.image_url || undefined,
              ticket_url: event.ticket_url || undefined,
              venue_name_raw: venueRaw,
              venue_normalized: venueNormalized,
              venue_id: venue?.id || null,
              location_name_raw: locationRaw,
              location_normalized: locationNormalized,
              location_id: location?.id || null,
              province: 'Málaga',
              country: 'ES',
              dedupe_key: dedupeKey,
            });
          
          if (insertError) {
            console.error(`Error inserting event "${cleanedTitle}":`, insertError.message);
            results.errors.push(`Insert error: ${cleanedTitle}`);
          } else {
            console.log(`Inserted: ${cleanedTitle} @ ${venueCanonical}, ${locationRaw}`);
            results.events_inserted++;
          }
        }
        
        // Delay between sources
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${source.name}:`, errorMsg);
        results.errors.push(`${source.name}: ${errorMsg}`);
      }
    }

    // Update sync run
    if (syncRun?.id) {
      await supabase
        .from('sync_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          inserted: results.events_inserted,
          updated: results.events_updated,
          skipped: results.events_skipped,
          errors: results.errors.length,
          error_details: results.errors.length > 0 ? results.errors : null,
        })
        .eq('id', syncRun.id);
    }

    console.log('Scraping completed:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-events:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
