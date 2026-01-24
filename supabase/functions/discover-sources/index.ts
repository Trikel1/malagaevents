import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URL patterns that indicate programming/events pages
const PROGRAMMING_PATTERNS = [
  /\/programacion/i,
  /\/programa\//i,
  /\/agenda/i,
  /\/eventos/i,
  /\/events/i,
  /\/cartelera/i,
  /\/calendario/i,
  /\/tickets/i,
  /\/conciertos/i,
  /\/shows/i,
  /\/proximos/i,
  /\/upcoming/i,
  /\/whats-on/i,
  /\/entradas/i,
  /\/espectaculos/i,
];

// Patterns to exclude (individual event pages, not listings)
const EXCLUDE_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/, // Date in URL (likely individual event)
  /\/evento\/[^\/]+$/i,
  /\/event\/[^\/]+$/i,
  /ticket-/i,
  /comprar-entrada/i,
  /buy-ticket/i,
  /\.pdf$/i,
  /\.jpg$/i,
  /\.png$/i,
];

interface DiscoveryResult {
  domain: string;
  entrypoints: string[];
  chosenEntrypoint: string;
  confidence: number;
  method: string;
}

// Score a URL based on how likely it is to be a programming page
function scoreUrl(url: string): number {
  let score = 0;
  
  for (const pattern of PROGRAMMING_PATTERNS) {
    if (pattern.test(url)) {
      score += 20;
    }
  }
  
  // Prefer shorter paths (listing pages are usually at root level)
  const pathDepth = (url.match(/\//g) || []).length;
  if (pathDepth <= 4) score += 10;
  if (pathDepth <= 3) score += 10;
  
  // Prefer pages without query params (cleaner URLs)
  if (!url.includes('?')) score += 5;
  
  // Exclude patterns reduce score
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(url)) {
      score -= 30;
    }
  }
  
  return score;
}

// Discover programming URLs for a domain using Firecrawl Map
async function discoverDomain(domain: string, apiKey: string): Promise<DiscoveryResult> {
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  console.log(`Discovering programming URLs for ${domain}...`);
  
  try {
    // Use Firecrawl Map to get all URLs on the domain
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        limit: 100,
        includeSubdomains: false,
      }),
    });

    if (!mapResponse.ok) {
      const error = await mapResponse.text();
      console.error(`Map failed for ${domain}:`, error);
      // Fall back to base URL
      return {
        domain,
        entrypoints: [baseUrl],
        chosenEntrypoint: baseUrl,
        confidence: 30,
        method: 'fallback',
      };
    }

    const mapResult = await mapResponse.json();
    const urls: string[] = mapResult.links || mapResult.data?.links || [];
    
    console.log(`Found ${urls.length} URLs for ${domain}`);
    
    if (urls.length === 0) {
      return {
        domain,
        entrypoints: [baseUrl],
        chosenEntrypoint: baseUrl,
        confidence: 30,
        method: 'fallback',
      };
    }
    
    // Score and rank URLs
    const scoredUrls = urls
      .map(url => ({ url, score: scoreUrl(url) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    console.log(`Top scored URLs for ${domain}:`, scoredUrls.slice(0, 5));
    
    if (scoredUrls.length === 0) {
      // No programming patterns found, use base URL
      return {
        domain,
        entrypoints: [baseUrl],
        chosenEntrypoint: baseUrl,
        confidence: 40,
        method: 'base_url',
      };
    }
    
    const topUrls = scoredUrls.slice(0, 5).map(item => item.url);
    const chosenUrl = topUrls[0];
    const confidence = Math.min(95, 50 + scoredUrls[0].score);
    
    return {
      domain,
      entrypoints: topUrls,
      chosenEntrypoint: chosenUrl,
      confidence,
      method: 'map_discovery',
    };
    
  } catch (error) {
    console.error(`Discovery error for ${domain}:`, error);
    return {
      domain,
      entrypoints: [baseUrl],
      chosenEntrypoint: baseUrl,
      confidence: 20,
      method: 'error_fallback',
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional domain filter
    let targetDomains: string[] | null = null;
    let forceRediscovery = false;
    
    try {
      const body = await req.json();
      if (body.domains && Array.isArray(body.domains)) {
        targetDomains = body.domains;
      }
      if (body.force) {
        forceRediscovery = true;
      }
    } catch {
      // No body - discover all
    }

    // Get sources to discover
    let query = supabase
      .from('sources_config')
      .select('*')
      .eq('is_active', true);
    
    if (targetDomains) {
      query = query.in('domain', targetDomains);
    }
    
    const { data: sources, error: sourcesError } = await query;
    
    if (sourcesError || !sources) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to load sources' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`=== STARTING DISCOVERY ===`);
    console.log(`Sources to discover: ${sources.map(s => s.domain).join(', ')}`);

    const results: DiscoveryResult[] = [];
    
    for (const source of sources) {
      // Skip if recently discovered and not forcing
      if (!forceRediscovery && source.last_discovery_at) {
        const lastDiscovery = new Date(source.last_discovery_at);
        const daysSinceDiscovery = (Date.now() - lastDiscovery.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceDiscovery < 7 && source.discovery_confidence >= 60) {
          console.log(`Skipping ${source.domain} - discovered ${daysSinceDiscovery.toFixed(1)} days ago with confidence ${source.discovery_confidence}`);
          results.push({
            domain: source.domain,
            entrypoints: source.entrypoints_detected || [],
            chosenEntrypoint: source.chosen_entrypoint || source.fallback_entrypoint,
            confidence: source.discovery_confidence,
            method: 'cached',
          });
          continue;
        }
      }
      
      const result = await discoverDomain(source.domain, firecrawlApiKey);
      results.push(result);
      
      // Update source config
      await supabase
        .from('sources_config')
        .update({
          entrypoints_detected: result.entrypoints,
          chosen_entrypoint: result.chosenEntrypoint,
          discovery_confidence: result.confidence,
          last_discovery_at: new Date().toISOString(),
          notes: `Discovery method: ${result.method}`,
          updated_at: new Date().toISOString(),
        })
        .eq('domain', source.domain);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`=== DISCOVERY COMPLETED ===`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total: results.length,
          high_confidence: results.filter(r => r.confidence >= 70).length,
          low_confidence: results.filter(r => r.confidence < 50).length,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discovery error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
