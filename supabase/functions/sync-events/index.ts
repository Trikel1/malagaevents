import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RATE_LIMIT_DELAY_MS = 3000;
const SCRAPE_TIMEOUT_MS = 45000;

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
// EVENT EXTRACTION SCHEMA FOR FIRECRAWL
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
          description: { type: 'string', description: 'Brief description (max 400 chars)' },
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
// LOGGING UTILITY
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details?: any;
}

class SyncLogger {
  private logs: LogEntry[] = [];
  private currentSource: string = 'sync';

  setSource(source: string) {
    this.currentSource = source;
  }

  info(message: string, details?: any) {
    this.log('info', message, details);
  }

  warn(message: string, details?: any) {
    this.log('warn', message, details);
  }

  error(message: string, details?: any) {
    this.log('error', message, details);
  }

  private log(level: 'info' | 'warn' | 'error', message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: this.currentSource,
      message,
      details,
    };
    this.logs.push(entry);
    
    const prefix = `[${level.toUpperCase()}][${this.currentSource}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, details || '');
    } else {
      console.log(`${prefix} ${message}`, details || '');
    }
  }

  getLogs() {
    return this.logs;
  }

  getErrorLogs() {
    return this.logs.filter(l => l.level === 'error');
  }
}

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
  
  if (/logo|icon|favicon|placeholder|default|avatar/i.test(url)) return undefined;
  if (url.startsWith('data:')) return undefined;
  
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
    
    url = url.replace(/^http:/, 'https:');
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
  
  if (/comedia|comedy|monólogo|humor|stand.?up|risas/i.test(text)) return 'comedy';
  if (/festival/i.test(text)) return 'festival';
  if (/teatro|theatre|obra|musical|danza|dance|circo|circus/i.test(text)) return 'theater';
  if (/dj|disco|fiesta|party|club|noche/i.test(text)) return 'nightlife';
  if (/concierto|concert|música|music|banda|band|live|directo/i.test(text)) return 'music';
  
  return sourceEventType;
}

// ============================================================================
// SCRAPING WITH FIRECRAWL (WITH RETRIES AND BACKOFF)
// ============================================================================

async function scrapeUrlWithRetry(
  url: string, 
  extractionPrompt: string, 
  apiKey: string,
  logger: SyncLogger,
  maxRetries = MAX_RETRIES
): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Scraping attempt ${attempt}/${maxRetries}: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['json'],
          jsonOptions: {
            schema: EVENT_EXTRACTION_SCHEMA,
            prompt: extractionPrompt,
          },
          onlyMainContent: true,
          waitFor: 5000,
          timeout: 40000,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl error ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      logger.info(`Scrape successful on attempt ${attempt}`);
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.warn(`Request timed out on attempt ${attempt}`);
      } else {
        logger.warn(`Attempt ${attempt} failed: ${lastError.message}`);
      }
      
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * attempt;
        logger.info(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
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
    .insert({ name: venueName, normalized_name: normalized, city, province: 'Málaga' })
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
  source: any,
  eventData: any,
  occurrences: Array<{ date: string; time?: string; end_time?: string }>,
  logger: SyncLogger
): Promise<{ inserted: boolean; updated: boolean; occurrences_created: number; skipped: boolean }> {
  const title = cleanTitle(eventData.title);
  if (!title) {
    logger.warn(`Skipping event with empty title`);
    return { inserted: false, updated: false, occurrences_created: 0, skipped: true };
  }
  
  const venueName = normalizeVenue(eventData.venue || '', source.default_venue);
  const locationName = eventData.city || source.default_location || 'Málaga';
  const eventType = determineEventType(title, eventData.description || '', source.event_type);
  
  const venueId = await getOrCreateVenue(supabase, venueName, locationName);
  const locationId = await getOrCreateLocation(supabase, locationName);
  
  const dedupeKey = generateDedupeKey(source.slug, title, venueName);
  
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
  
  const sourceUrl = source.chosen_entrypoint || source.fallback_entrypoint;
  const imageUrl = normalizeImageUrl(eventData.image_url, sourceUrl);
  const imageStatus = imageUrl ? 'ok' : 'missing';
  
  const eventPayload = {
    title,
    description: eventData.description?.substring(0, 500) || `Evento en ${venueName}`,
    description_short: eventData.description?.substring(0, 150) || null,
    description_full: eventData.description || null,
    category: source.category,
    event_type: eventType,
    source: source.slug,
    source_type: 'official_feed',
    source_ref: sourceUrl,
    url: sourceUrl,
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
    eventId = existingEvent.id;
    await supabase.from('events').update(eventPayload).eq('id', eventId);
    isUpdated = true;
    logger.info(`Updated event: ${title}`);
  } else {
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
      logger.error(`Error inserting event "${title}": ${error.message}`);
      return { inserted: false, updated: false, occurrences_created: 0, skipped: true };
    }
    
    eventId = newEvent.id;
    isNew = true;
    logger.info(`Inserted new event: ${title}`);
  }
  
  // Upsert occurrences
  let occurrencesCreated = 0;
  const now = new Date();
  
  for (const occ of occurrences) {
    const startDatetime = parseSpanishDate(occ.date, occ.time);
    if (!startDatetime || startDatetime < now) continue;
    
    const endDatetime = occ.end_time ? parseSpanishDate(occ.date, occ.end_time) : null;
    
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
      
      if (!occError) occurrencesCreated++;
    }
  }
  
  // Update event's start_at to next upcoming occurrence
  const { data: nextOcc } = await supabase
    .from('event_occurrences')
    .select('start_datetime')
    .eq('event_id', eventId)
    .gte('start_datetime', now.toISOString())
    .order('start_datetime', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (nextOcc) {
    await supabase.from('events').update({ start_at: nextOcc.start_datetime }).eq('id', eventId);
  }
  
  return { inserted: isNew, updated: isUpdated, occurrences_created: occurrencesCreated, skipped: false };
}

// ============================================================================
// ARCHIVE OLD EVENTS
// ============================================================================

async function archiveStaleEvents(supabase: any, logger: SyncLogger): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7); // Archive if not synced in 7 days
  
  const { data: staleEvents, error } = await supabase
    .from('events')
    .update({ status: 'archived' })
    .lt('last_synced_at', cutoffDate.toISOString())
    .eq('status', 'published')
    .select('id');
  
  if (error) {
    logger.error('Error archiving stale events', error);
    return 0;
  }
  
  const count = staleEvents?.length || 0;
  if (count > 0) {
    logger.info(`Archived ${count} stale events`);
  }
  
  return count;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new SyncLogger();
  logger.setSource('main');
  logger.info('=== STARTING SYNC ===');

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      logger.error('Firecrawl API key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured', logs: logger.getLogs() }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let targetSlugs: string[] | null = null;
    let runDiscovery = false;
    
    try {
      const body = await req.json();
      if (body.sources && Array.isArray(body.sources)) {
        targetSlugs = body.sources;
      }
      if (body.discover) {
        runDiscovery = true;
      }
    } catch {
      // No body - run all sources
    }

    // Get sources from database
    let query = supabase
      .from('sources_config')
      .select('*')
      .eq('is_active', true);
    
    if (targetSlugs) {
      query = query.in('slug', targetSlugs);
    }
    
    const { data: sources, error: sourcesError } = await query;
    
    if (sourcesError || !sources || sources.length === 0) {
      logger.error('No active sources found');
      return new Response(
        JSON.stringify({ success: false, error: 'No active sources found', logs: logger.getLogs() }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info(`Found ${sources.length} active sources: ${sources.map(s => s.name).join(', ')}`);

    const results = {
      sources_processed: 0,
      sources_success: 0,
      sources_failed: 0,
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      events_skipped: 0,
      events_archived: 0,
      occurrences_created: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const source of sources) {
      logger.setSource(source.slug);
      logger.info(`--- Processing: ${source.name} ---`);
      
      // Create sync run record
      const { data: syncRun } = await supabase
        .from('sync_runs')
        .insert({ source: source.slug, status: 'running' })
        .select('id')
        .single();

      const sourceResults = {
        source: source.name,
        slug: source.slug,
        url: source.chosen_entrypoint || source.fallback_entrypoint,
        inserted: 0,
        updated: 0,
        skipped: 0,
        occurrences: 0,
        eventsFound: 0,
        error: null as string | null,
      };

      try {
        const urlToScrape = source.chosen_entrypoint || source.fallback_entrypoint;
        
        if (!urlToScrape) {
          throw new Error('No entrypoint URL configured');
        }
        
        const extractionPrompt = `Extrae todos los eventos/espectáculos/conciertos de la página. Para cada evento: title, description (breve), occurrences (todas las fechas en formato DD/MM/YYYY y hora HH:MM), venue, city, image_url, ticket_url, price.`;
        
        const scrapeResult = await scrapeUrlWithRetry(urlToScrape, extractionPrompt, firecrawlApiKey, logger);
        results.sources_processed++;
        
        // Extract events
        let events: any[] = [];
        if (scrapeResult.success && scrapeResult.data) {
          if (scrapeResult.data.json?.events) {
            events = scrapeResult.data.json.events;
          } else if (scrapeResult.data.events) {
            events = scrapeResult.data.events;
          }
        }
        
        events = events.filter((e: any) => e.title && isValidEventTitle(e.title));
        
        sourceResults.eventsFound = events.length;
        results.events_found += events.length;
        
        logger.info(`Found ${events.length} valid events`);
        
        if (events.length === 0) {
          sourceResults.error = 'No valid events extracted';
          results.errors.push(`${source.name}: No events found`);
          logger.warn('No valid events found in scrape result');
        }
        
        for (const event of events) {
          let occurrences = event.occurrences || [];
          
          if (occurrences.length === 0 && event.date) {
            occurrences = [{ date: event.date, time: event.time }];
          }
          
          if (occurrences.length === 0) {
            sourceResults.skipped++;
            continue;
          }
          
          const result = await upsertEventWithOccurrences(supabase, source, event, occurrences, logger);
          
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
        
        // Update source last_sync_at
        await supabase
          .from('sources_config')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('slug', source.slug);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Processing failed: ${errorMsg}`);
        sourceResults.error = errorMsg;
        results.errors.push(`${source.name}: ${errorMsg}`);
        results.sources_failed++;
        
        if (syncRun?.id) {
          await supabase
            .from('sync_runs')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              errors: 1,
              error_details: { message: errorMsg, logs: logger.getErrorLogs() },
            })
            .eq('id', syncRun.id);
        }
      }
      
      results.details.push(sourceResults);
      
      // Rate limiting between sources
      if (sources.indexOf(source) < sources.length - 1) {
        logger.info(`Rate limiting: waiting ${RATE_LIMIT_DELAY_MS}ms`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    // Archive stale events
    logger.setSource('archiver');
    results.events_archived = await archiveStaleEvents(supabase, logger);

    logger.setSource('main');
    logger.info('=== SYNC COMPLETED ===');
    logger.info(`Sources: ${results.sources_success}/${results.sources_processed} successful`);
    logger.info(`Events: ${results.events_inserted} new, ${results.events_updated} updated, ${results.events_archived} archived`);

    return new Response(
      JSON.stringify({ success: true, results, logs: logger.getLogs() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Fatal sync error', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', logs: logger.getLogs() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
