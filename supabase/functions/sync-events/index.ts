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
  category: string;
  defaultVenue: string;
  defaultLocation: string;
  extractionPrompt: string;
}

const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    name: 'Teatro del Soho CaixaBank',
    slug: 'teatro-soho',
    url: 'https://teatrodelsoho.com/',
    category: 'theater',
    defaultVenue: 'Teatro del Soho CaixaBank',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL theater shows/events from this page. For each show:
- title: exact show name
- description: brief description
- dates: ALL performance dates (may be a range like "del 15 al 30 de enero" - list each date)
- times: ALL showtimes for each date (e.g., "20:00", "17:00 y 20:00")
- image_url: main poster/image
- ticket_url: link to buy tickets
- price: ticket price if shown
For shows with multiple dates/times, list EACH occurrence separately.`,
  },
  {
    name: 'Teatro Cervantes',
    slug: 'teatro-cervantes',
    url: 'https://www.teatrocervantes.com/',
    category: 'theater',
    defaultVenue: 'Teatro Cervantes',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL theater/dance/music events from the programming. For each event:
- title: exact event name
- description: brief description
- dates: ALL performance dates (convert ranges to individual dates)
- times: ALL showtimes
- venue: specific hall/sala if mentioned (Cervantes, Echegaray)
- image_url: event poster
- ticket_url: purchase link
- price: ticket prices
List EACH date+time as a separate occurrence.`,
  },
  {
    name: 'Sala Eventual',
    slug: 'eventual-music',
    url: 'https://www.eventualmusic.com/',
    category: 'music',
    defaultVenue: 'Sala Eventual',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL concerts/events from this music venue page. For each event:
- title: artist/band name + event title
- description: event description
- date: concert date
- time: doors open / start time
- image_url: event flyer/poster
- ticket_url: ticket purchase link
- price: ticket price`,
  },
  {
    name: 'Sala Trinchera',
    slug: 'sala-trinchera',
    url: 'https://salatrinchera.com/',
    category: 'music',
    defaultVenue: 'Sala Trinchera',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL concerts/events from this venue. For each:
- title: artist/event name
- description: event info
- date: event date
- time: start time
- image_url: event image/flyer
- ticket_url: ticket link
- price: entry price`,
  },
  {
    name: 'París 15',
    slug: 'paris-15',
    url: 'https://paris15.es/',
    category: 'music',
    defaultVenue: 'París 15',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL upcoming events/concerts/parties from this venue. For each:
- title: event/artist name
- description: event description
- date: event date
- time: start time
- image_url: event poster/flyer
- ticket_url: ticket purchase link
- price: entry price`,
  },
  {
    name: 'Sala Marte',
    slug: 'sala-marte',
    url: 'https://salamartemalaga.com/',
    category: 'music',
    defaultVenue: 'Sala Marte',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL concerts/events from this venue page. For each:
- title: artist/event name
- description: event info
- date: event date
- time: doors/start time
- image_url: event flyer
- ticket_url: ticket link
- price: entry fee`,
  },
  {
    name: 'Antojo Málaga',
    slug: 'antojo-malaga',
    url: 'https://antojomalaga.es/',
    category: 'music',
    defaultVenue: 'Antojo Málaga',
    defaultLocation: 'Málaga',
    extractionPrompt: `Extract ALL events/concerts from this venue. For each:
- title: event/artist name
- description: event details
- date: event date
- time: start time
- image_url: event image
- ticket_url: ticket link
- price: entry price`,
  },
];

// ============================================================================
// VENUE AND LOCATION NORMALIZATION
// ============================================================================

const VENUE_ALIASES: Record<string, string> = {
  'teatro del soho': 'Teatro del Soho CaixaBank',
  'teatro soho': 'Teatro del Soho CaixaBank',
  'soho caixabank': 'Teatro del Soho CaixaBank',
  'teatro cervantes': 'Teatro Cervantes',
  'cervantes': 'Teatro Cervantes',
  'teatro echegaray': 'Teatro Echegaray',
  'echegaray': 'Teatro Echegaray',
  'sala trinchera': 'Sala Trinchera',
  'trinchera': 'Sala Trinchera',
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
// EXTRACTION SCHEMA
// ============================================================================

const EVENT_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event/show name' },
          description: { type: 'string', description: 'Brief description (max 500 chars)' },
          occurrences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', description: 'Date in DD/MM/YYYY format' },
                time: { type: 'string', description: 'Start time in HH:MM format' },
                end_time: { type: 'string', description: 'End time if available' },
              },
              required: ['date'],
            },
            description: 'All dates/times when this event occurs',
          },
          venue: { type: 'string', description: 'Venue/hall name' },
          city: { type: 'string', description: 'City/town name' },
          image_url: { type: 'string', description: 'Main event image URL' },
          ticket_url: { type: 'string', description: 'Ticket purchase URL' },
          price: { type: 'string', description: 'Ticket price' },
          is_free: { type: 'boolean', description: 'Whether event is free' },
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
  const lower = venueRaw.toLowerCase().trim();
  return VENUE_ALIASES[lower] || defaultVenue;
}

function parseSpanishDate(dateText: string, timeText?: string): Date | null {
  if (!dateText) return null;
  
  const months: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  };
  
  let hour = 20, minute = 0;
  
  if (timeText) {
    const timeMatch = timeText.match(/(\d{1,2})[:\.](\d{2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = parseInt(timeMatch[2]);
    }
  }
  
  // Spanish format: "15 de enero de 2025"
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
  
  // Numeric: "15/01/2025" or "15-01-2025"
  const numericMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    let year = parseInt(numericMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day, hour, minute);
  }
  
  // ISO: "2025-01-15"
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), hour, minute);
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
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(title)) return false;
  }
  
  return true;
}

function normalizeImageUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  
  // Skip logos and icons
  if (/logo|icon|favicon/i.test(url)) return undefined;
  
  // Make absolute
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    const base = new URL(baseUrl);
    url = base.origin + url;
  }
  
  // Force HTTPS
  url = url.replace(/^http:/, 'https:');
  
  return url;
}

function generateDedupeKey(sourceSlug: string, title: string, startAt: string): string {
  const combined = `${sourceSlug}|${title}|${startAt}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${sourceSlug}_${Math.abs(hash).toString(36)}`;
}

// ============================================================================
// SCRAPING WITH FIRECRAWL
// ============================================================================

async function scrapeSource(adapter: SourceAdapter, apiKey: string): Promise<any> {
  console.log(`Scraping ${adapter.name} from ${adapter.url}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: adapter.url,
      formats: ['markdown', 'json'],
      jsonOptions: {
        schema: EVENT_EXTRACTION_SCHEMA,
        prompt: adapter.extractionPrompt,
      },
      onlyMainContent: true,
      waitFor: 5000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Firecrawl error for ${adapter.name}:`, error);
    throw new Error(`Firecrawl request failed: ${response.status}`);
  }

  return response.json();
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
    .insert({ name: venueName, normalized_name: normalized, city })
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
): Promise<{ inserted: boolean; occurrences_created: number }> {
  const title = cleanTitle(eventData.title);
  const venueName = normalizeVenue(eventData.venue || '', adapter.defaultVenue);
  const locationName = eventData.city || adapter.defaultLocation;
  
  // Get or create venue and location
  const venueId = await getOrCreateVenue(supabase, venueName, locationName);
  const locationId = await getOrCreateLocation(supabase, locationName);
  
  // Check if event exists by source + title
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('source', adapter.slug)
    .eq('title', title)
    .maybeSingle();
  
  let eventId: string;
  let isNew = false;
  
  const isFree = eventData.is_free || 
    (eventData.price && /gratis|free|entrada libre|0\s*€/i.test(eventData.price));
  
  const eventPayload = {
    title,
    description: eventData.description?.substring(0, 500) || `Evento en ${venueName}`,
    description_short: eventData.description?.substring(0, 150),
    description_full: eventData.description,
    category: adapter.category,
    source: adapter.slug,
    source_type: 'official_feed',
    source_ref: adapter.url,
    url: adapter.url,
    venue_name: venueName,
    venue_id: venueId,
    venue_name_raw: eventData.venue,
    venue_normalized: normalizeText(venueName),
    location_id: locationId,
    location_name_raw: locationName,
    location_normalized: normalizeText(locationName),
    province: 'Málaga',
    country: 'ES',
    image_url: normalizeImageUrl(eventData.image_url, adapter.url),
    buy_url: eventData.ticket_url,
    ticket_url: eventData.ticket_url,
    is_free: isFree,
    price_info: isFree ? 'Gratis' : eventData.price,
    status: 'published',
    last_synced_at: new Date().toISOString(),
  };
  
  if (existingEvent) {
    // Update existing
    eventId = existingEvent.id;
    await supabase
      .from('events')
      .update(eventPayload)
      .eq('id', eventId);
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
        dedupe_key: generateDedupeKey(adapter.slug, title, startAt?.toISOString() || ''),
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error inserting event:', error);
      return { inserted: false, occurrences_created: 0 };
    }
    
    eventId = newEvent.id;
    isNew = true;
  }
  
  // Upsert occurrences
  let occurrencesCreated = 0;
  
  for (const occ of occurrences) {
    const startDatetime = parseSpanishDate(occ.date, occ.time);
    if (!startDatetime) continue;
    
    // Skip past occurrences
    if (startDatetime < new Date()) continue;
    
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
          end_datetime: endDatetime?.toISOString(),
          buy_url: eventData.ticket_url,
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
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (nextOcc) {
    await supabase
      .from('events')
      .update({ start_at: nextOcc.start_datetime })
      .eq('id', eventId);
  }
  
  return { inserted: isNew, occurrences_created: occurrencesCreated };
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
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
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

    console.log(`Starting sync for ${adaptersToRun.length} sources...`);

    const results = {
      sources_processed: 0,
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      occurrences_created: 0,
      errors: [] as string[],
    };

    for (const adapter of adaptersToRun) {
      // Create sync run record
      const { data: syncRun } = await supabase
        .from('sync_runs')
        .insert({ source: adapter.slug, status: 'running' })
        .select('id')
        .single();

      const sourceResults = {
        inserted: 0,
        updated: 0,
        occurrences: 0,
        errors: 0,
      };

      try {
        console.log(`Processing: ${adapter.name}`);
        
        const scrapeResult = await scrapeSource(adapter, firecrawlApiKey);
        results.sources_processed++;
        
        if (!scrapeResult.success || !scrapeResult.data?.json?.events) {
          console.log(`No events found for ${adapter.name}`);
          results.errors.push(`${adapter.name}: No events extracted`);
          continue;
        }
        
        const events = scrapeResult.data.json.events.filter(
          (e: any) => e.title && isValidEventTitle(e.title)
        );
        
        results.events_found += events.length;
        console.log(`Found ${events.length} valid events from ${adapter.name}`);
        
        for (const event of events) {
          // Build occurrences array
          let occurrences = event.occurrences || [];
          
          // If no occurrences but has date field, create single occurrence
          if (occurrences.length === 0 && event.date) {
            occurrences = [{ date: event.date, time: event.time }];
          }
          
          // If still no occurrences, create one for next week
          if (occurrences.length === 0) {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            occurrences = [{ 
              date: `${nextWeek.getDate()}/${nextWeek.getMonth() + 1}/${nextWeek.getFullYear()}`,
              time: '20:00'
            }];
          }
          
          const { inserted, occurrences_created } = await upsertEventWithOccurrences(
            supabase,
            adapter,
            event,
            occurrences
          );
          
          if (inserted) {
            results.events_inserted++;
            sourceResults.inserted++;
          } else {
            results.events_updated++;
            sourceResults.updated++;
          }
          
          results.occurrences_created += occurrences_created;
          sourceResults.occurrences += occurrences_created;
        }
        
        // Update sync run
        if (syncRun?.id) {
          await supabase
            .from('sync_runs')
            .update({
              status: 'completed',
              finished_at: new Date().toISOString(),
              inserted: sourceResults.inserted,
              updated: sourceResults.updated,
              occurrences_created: sourceResults.occurrences,
            })
            .eq('id', syncRun.id);
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${adapter.name}:`, errorMsg);
        results.errors.push(`${adapter.name}: ${errorMsg}`);
        
        if (syncRun?.id) {
          await supabase
            .from('sync_runs')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              errors: 1,
              error_details: [errorMsg],
            })
            .eq('id', syncRun.id);
        }
      }
    }

    console.log('Sync completed:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-events:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
