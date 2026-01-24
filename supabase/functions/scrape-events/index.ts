import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official Málaga event sources
const EVENT_SOURCES = [
  {
    name: 'Agenda Municipal Málaga',
    url: 'https://www.malaga.eu/la-ciudad/agenda/',
    category: 'other',
  },
  {
    name: 'Teatro Cervantes',
    url: 'https://www.teatrocervantes.es/programacion/',
    category: 'theater',
  },
  {
    name: 'CAC Málaga',
    url: 'https://cacmalaga.eu/exposiciones/',
    category: 'exhibitions',
  },
  {
    name: 'La Térmica',
    url: 'https://www.latermicamalaga.com/agenda/',
    category: 'music',
  },
  {
    name: 'Museo Picasso Málaga',
    url: 'https://www.museopicassomalaga.org/actividades',
    category: 'exhibitions',
  },
  {
    name: 'Centre Pompidou Málaga',
    url: 'https://centrepompidou-malaga.eu/actividades/',
    category: 'exhibitions',
  },
  {
    name: 'Diputación de Málaga Cultura',
    url: 'https://www.malaga.es/cultura/agenda/',
    category: 'other',
  },
  {
    name: 'Más Málaga',
    url: 'https://mmalaga.es/agenda/',
    category: 'other',
  },
  {
    name: 'Más Málaga Conciertos',
    url: 'https://mmalaga.es/conciertos-malaga/',
    category: 'music',
  },
  {
    name: 'Más Málaga Teatro',
    url: 'https://mmalaga.es/teatro-malaga/',
    category: 'theater',
  },
  {
    name: 'Teatro Echegaray',
    url: 'https://www.teatroechegaray.es/programacion/',
    category: 'theater',
  },
  {
    name: 'Fundación Unicaja',
    url: 'https://fundacionunicaja.com/agenda/',
    category: 'exhibitions',
  },
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
          title: {
            type: 'string',
            description: 'The name/title of the event',
          },
          description: {
            type: 'string',
            description: 'A brief description of the event (max 500 chars)',
          },
          date: {
            type: 'string',
            description: 'The date of the event in format DD/MM/YYYY or descriptive like "15 de enero de 2025"',
          },
          time: {
            type: 'string',
            description: 'The start time of the event like "20:00" or "8pm"',
          },
          venue: {
            type: 'string',
            description: 'The venue or location name where the event takes place',
          },
          address: {
            type: 'string',
            description: 'The street address of the venue',
          },
          price: {
            type: 'string',
            description: 'The ticket price or "Gratis" if free',
          },
          image_url: {
            type: 'string',
            description: 'URL of the event image or poster',
          },
          ticket_url: {
            type: 'string',
            description: 'URL to buy tickets',
          },
          is_free: {
            type: 'boolean',
            description: 'Whether the event is free',
          },
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
  address?: string;
  price?: string;
  image_url?: string;
  ticket_url?: string;
  is_free?: boolean;
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<any> {
  console.log(`Scraping URL: ${url}`);
  
  // First try with JSON extraction
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
        prompt: 'Extract all upcoming cultural events from this page. For each event get: title, description, date (in DD/MM/YYYY format), time (in HH:MM format), venue name, address, price, image URL, ticket URL, and whether it is free.',
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
  
  // Parse time if provided
  if (timeText) {
    const timeMatch = timeText.match(/(\d{1,2})[:\.]?(\d{2})?/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (timeText.toLowerCase().includes('pm') && hour < 12) hour += 12;
    }
  }
  
  // Try Spanish format: "15 de enero" or "15 de enero de 2025"
  const spanishMatch = dateText.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1]);
    const monthStr = spanishMatch[2].toLowerCase();
    const month = months[monthStr];
    if (!isNaN(day) && month !== undefined) {
      let year = spanishMatch[3] ? parseInt(spanishMatch[3]) : new Date().getFullYear();
      const date = new Date(year, month, day, hour, minute);
      // If date is in the past and no year specified, use next year
      if (date < new Date() && !spanishMatch[3]) {
        date.setFullYear(year + 1);
      }
      return date;
    }
  }
  
  // Try numeric format: "15/01/2025" or "15-01-2025"
  const numericMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    let year = parseInt(numericMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day, hour, minute);
  }
  
  // Try ISO format
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
    .replace(/\[.*?\]/g, '') // Remove markdown links
    .replace(/\(https?:\/\/[^)]+\)/g, '') // Remove URLs in parens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 200);
}

function isValidEventTitle(title: string): boolean {
  if (!title || title.length < 4 || title.length > 200) return false;
  
  // Filter out navigation/UI elements
  const invalidPatterns = [
    /^(menu|inicio|home|contacto|about|cookies|privacidad|legal|newsletter)/i,
    /^(ver más|leer más|read more|see more|siguiente|anterior)/i,
    /^(aceptar|rechazar|cerrar|close|accept|reject)/i,
    /^(agenda|programación|programa|calendar|eventos)$/i,
    /^(facebook|twitter|instagram|youtube|linkedin)/i,
    /^\d+$/, // Just numbers
    /^[^a-záéíóúñ]+$/i, // No letters
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(title)) return false;
  }
  
  return true;
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

    console.log('Starting structured event scraping from official sources...');
    
    const results = {
      sources_scraped: 0,
      events_found: 0,
      events_inserted: 0,
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
        
        // Get events from structured JSON extraction
        let events: ExtractedEvent[] = [];
        
        if (scrapeResult.data?.json?.events) {
          events = scrapeResult.data.json.events;
          console.log(`JSON extraction found ${events.length} events from ${source.name}`);
        }
        
        // Filter and process events
        const validEvents = events.filter(e => e.title && isValidEventTitle(e.title));
        results.events_found += validEvents.length;
        
        console.log(`${validEvents.length} valid events from ${source.name}`);
        
        for (const event of validEvents) {
          const cleanedTitle = cleanTitle(event.title);
          
          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('title', cleanedTitle)
            .eq('source_type', 'official_feed')
            .maybeSingle();
          
          if (existing) {
            results.events_skipped++;
            continue;
          }
          
          // Parse date
          let startAt = parseSpanishDate(event.date || '', event.time);
          if (!startAt) {
            // Default to a week from now if no date found
            startAt = new Date();
            startAt.setDate(startAt.getDate() + 7);
            startAt.setHours(20, 0, 0, 0);
          }
          
          // Skip events that are too far in the past
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          if (startAt < oneMonthAgo) {
            results.events_skipped++;
            continue;
          }
          
          // Determine if free
          const isFree = event.is_free || 
            (event.price && /gratis|free|entrada libre|0\s*€/i.test(event.price)) ||
            false;
          
          // Build price info
          let priceInfo = event.price;
          if (isFree) {
            priceInfo = 'Gratis';
          } else if (!priceInfo) {
            priceInfo = undefined;
          }
          
          // Insert the event
          const { error: insertError } = await supabase
            .from('events')
            .insert({
              title: cleanedTitle,
              description: event.description?.substring(0, 1000) || `Evento en ${event.venue || source.name}`,
              category: source.category,
              start_at: startAt.toISOString(),
              venue_name: event.venue || source.name,
              address: event.address || `${source.name}, Málaga`,
              source_type: 'official_feed',
              source_ref: source.url,
              status: 'published',
              is_free: isFree,
              price_info: priceInfo,
              image_url: event.image_url || undefined,
              ticket_url: event.ticket_url || undefined,
            });
          
          if (insertError) {
            console.error(`Error inserting event "${cleanedTitle}":`, insertError.message);
            results.errors.push(`Insert error: ${cleanedTitle}`);
          } else {
            console.log(`Inserted: ${cleanedTitle}`);
            results.events_inserted++;
          }
        }
        
        // Delay between sources to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${source.name}:`, errorMsg);
        results.errors.push(`${source.name}: ${errorMsg}`);
      }
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
