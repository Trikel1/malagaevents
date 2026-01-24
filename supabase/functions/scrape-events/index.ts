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
];

interface ScrapedEvent {
  title: string;
  description?: string;
  venue_name?: string;
  date_text?: string;
  url?: string;
  image_url?: string;
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
      formats: ['markdown', 'links'],
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

function parseEventsFromMarkdown(markdown: string, sourceName: string, category: string): ScrapedEvent[] {
  const events: ScrapedEvent[] = [];
  
  // Split by common event patterns (headers, list items)
  const lines = markdown.split('\n');
  let currentEvent: Partial<ScrapedEvent> | null = null;
  
  for (const line of lines) {
    // Look for event titles (headers or bold text)
    const headerMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\*\*(.+)\*\*/);
    if (headerMatch) {
      if (currentEvent?.title) {
        events.push(currentEvent as ScrapedEvent);
      }
      currentEvent = {
        title: headerMatch[1].trim(),
        venue_name: sourceName,
      };
      continue;
    }
    
    // Look for dates
    const datePatterns = [
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{1,2})-(\d{1,2})-(\d{4})/,
    ];
    
    for (const pattern of datePatterns) {
      const dateMatch = line.match(pattern);
      if (dateMatch && currentEvent) {
        currentEvent.date_text = dateMatch[0];
        break;
      }
    }
    
    // Look for descriptions (any text after a title)
    if (currentEvent && !currentEvent.description && line.trim().length > 20 && !line.startsWith('#') && !line.startsWith('*')) {
      currentEvent.description = line.trim().substring(0, 500);
    }
  }
  
  // Add last event
  if (currentEvent?.title) {
    events.push(currentEvent as ScrapedEvent);
  }
  
  // Filter and clean events
  return events
    .filter(e => e.title && e.title.length > 3 && e.title.length < 200)
    .map(e => ({
      ...e,
      title: e.title.replace(/\[|\]/g, '').trim(),
    }))
    .slice(0, 20); // Limit to 20 events per source
}

function parseSpanishDate(dateText: string): Date | null {
  const months: Record<string, number> = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
  };
  
  // Try Spanish format: "15 de enero"
  const spanishMatch = dateText.match(/(\d{1,2})\s+de\s+(\w+)/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1]);
    const month = months[spanishMatch[2].toLowerCase()];
    if (!isNaN(day) && month !== undefined) {
      const year = new Date().getFullYear();
      const date = new Date(year, month, day, 20, 0); // Default to 8pm
      // If date is in the past, use next year
      if (date < new Date()) {
        date.setFullYear(year + 1);
      }
      return date;
    }
  }
  
  // Try numeric format: "15/01/2025"
  const numericMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    const year = parseInt(numericMatch[3]);
    return new Date(year, month, day, 20, 0);
  }
  
  return null;
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

    console.log('Starting event scraping from official sources...');
    
    const results = {
      sources_scraped: 0,
      events_found: 0,
      events_inserted: 0,
      errors: [] as string[],
    };

    for (const source of EVENT_SOURCES) {
      try {
        console.log(`Processing source: ${source.name}`);
        
        const scrapeResult = await scrapeWithFirecrawl(source.url, firecrawlApiKey);
        results.sources_scraped++;
        
        if (!scrapeResult.success || !scrapeResult.data?.markdown) {
          console.log(`No content from ${source.name}`);
          continue;
        }
        
        const events = parseEventsFromMarkdown(
          scrapeResult.data.markdown,
          source.name,
          source.category
        );
        
        console.log(`Found ${events.length} events from ${source.name}`);
        results.events_found += events.length;
        
        for (const event of events) {
          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('title', event.title)
            .eq('source_type', 'official_feed')
            .maybeSingle();
          
          if (existing) {
            console.log(`Event already exists: ${event.title}`);
            continue;
          }
          
          // Parse date or use a default future date
          let startAt = event.date_text ? parseSpanishDate(event.date_text) : null;
          if (!startAt) {
            // Default to a week from now
            startAt = new Date();
            startAt.setDate(startAt.getDate() + 7);
            startAt.setHours(20, 0, 0, 0);
          }
          
          // Insert the event
          const { error: insertError } = await supabase
            .from('events')
            .insert({
              title: event.title,
              description: event.description || `Evento en ${event.venue_name || source.name}`,
              category: source.category,
              start_at: startAt.toISOString(),
              venue_name: event.venue_name || source.name,
              address: `${source.name}, Málaga`,
              source_type: 'official_feed',
              source_ref: source.url,
              status: 'published',
              is_free: false,
              image_url: event.image_url,
            });
          
          if (insertError) {
            console.error(`Error inserting event ${event.title}:`, insertError);
            results.errors.push(`Insert error: ${event.title}`);
          } else {
            console.log(`Inserted event: ${event.title}`);
            results.events_inserted++;
          }
        }
        
        // Small delay between sources to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing ${source.name}:`, error);
        results.errors.push(`${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('Scraping completed:', results);

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
