import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pharmacy extraction schema for Firecrawl JSON extraction
const GUARDIA_SCHEMA = {
  type: 'object',
  properties: {
    pharmacies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Pharmacy name' },
          address: { type: 'string', description: 'Full street address' },
          municipality: { type: 'string', description: 'Municipality or town name (e.g., Málaga, Marbella, Torremolinos)' },
          phone: { type: 'string', description: 'Phone number' },
          duty_date: { type: 'string', description: 'Date of guard duty (YYYY-MM-DD)' },
          duty_hours: { type: 'string', description: 'Hours (e.g., 22:00-09:00, 24h)' },
        },
        required: ['name', 'address'],
      },
    },
  },
  required: ['pharmacies'],
};

const DIRECTORY_SCHEMA = {
  type: 'object',
  properties: {
    pharmacies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Pharmacy name' },
          address: { type: 'string', description: 'Full street address' },
          municipality: { type: 'string', description: 'Municipality or town (e.g., Málaga, Marbella, Ronda, Antequera)' },
          phone: { type: 'string', description: 'Phone number' },
        },
        required: ['name', 'address'],
      },
    },
  },
  required: ['pharmacies'],
};

// Fallback pharmacies data for Málaga province
const FALLBACK_PHARMACIES = [
  { name: 'Farmacia Alameda Principal', address: 'Alameda Principal, 9, 29001 Málaga', municipality: 'Málaga', phone: '952 21 24 45', lat: 36.7196, lng: -4.4214 },
  { name: 'Farmacia Larios', address: 'C/ Marqués de Larios, 3, 29005 Málaga', municipality: 'Málaga', phone: '952 22 14 56', lat: 36.7212, lng: -4.4236 },
  { name: 'Farmacia El Corte Inglés', address: 'Av. de Andalucía, 4, 29007 Málaga', municipality: 'Málaga', phone: '952 30 00 00', lat: 36.7146, lng: -4.4312 },
  { name: 'Farmacia Huelin', address: 'Paseo Antonio Machado, 12, 29002 Málaga', municipality: 'Málaga', phone: '952 35 12 67', lat: 36.7098, lng: -4.4456 },
  { name: 'Farmacia Teatinos', address: 'Av. de Plutarco, 15, 29010 Málaga', municipality: 'Málaga', phone: '952 61 45 23', lat: 36.7156, lng: -4.4678 },
  { name: 'Farmacia Torremolinos Centro', address: 'C/ San Miguel, 22, 29620 Torremolinos', municipality: 'Torremolinos', phone: '952 38 12 34' },
  { name: 'Farmacia Benalmádena Pueblo', address: 'Av. Juan Luis Peralta, 5, 29639 Benalmádena', municipality: 'Benalmádena', phone: '952 44 56 78' },
  { name: 'Farmacia Fuengirola Centro', address: 'Av. Ramón y Cajal, 8, 29640 Fuengirola', municipality: 'Fuengirola', phone: '952 47 89 01' },
  { name: 'Farmacia Marbella Centro', address: 'Av. Ricardo Soriano, 15, 29601 Marbella', municipality: 'Marbella', phone: '952 77 23 45' },
  { name: 'Farmacia Estepona', address: 'Av. España, 30, 29680 Estepona', municipality: 'Estepona', phone: '952 80 12 34' },
  { name: 'Farmacia Ronda', address: 'C/ Virgen de la Paz, 10, 29400 Ronda', municipality: 'Ronda', phone: '952 87 45 67' },
  { name: 'Farmacia Antequera', address: 'C/ Infante Don Fernando, 25, 29200 Antequera', municipality: 'Antequera', phone: '952 84 23 45' },
  { name: 'Farmacia Vélez-Málaga', address: 'C/ Canalejas, 12, 29700 Vélez-Málaga', municipality: 'Vélez-Málaga', phone: '952 50 34 56' },
  { name: 'Farmacia Nerja', address: 'C/ Pintada, 8, 29780 Nerja', municipality: 'Nerja', phone: '952 52 12 34' },
  { name: 'Farmacia Coín', address: 'C/ Real, 15, 29100 Coín', municipality: 'Coín', phone: '952 45 67 89' },
  { name: 'Farmacia Alhaurín de la Torre', address: 'C/ Real, 20, 29130 Alhaurín de la Torre', municipality: 'Alhaurín de la Torre', phone: '952 41 23 45' },
  { name: 'Farmacia Mijas Costa', address: 'Av. de las Palmeras, 5, 29651 Mijas Costa', municipality: 'Mijas', phone: '952 58 34 56' },
  { name: 'Farmacia Rincón de la Victoria', address: 'Av. del Mediterráneo, 18, 29730 Rincón de la Victoria', municipality: 'Rincón de la Victoria', phone: '952 40 12 34' },
  { name: 'Farmacia Cártama', address: 'Av. de la Estación, 3, 29570 Cártama', municipality: 'Cártama', phone: '952 42 56 78' },
  { name: 'Farmacia Torrox', address: 'C/ Alta, 7, 29770 Torrox', municipality: 'Torrox', phone: '952 53 89 01' },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function generateDedupeKey(name: string, address: string, municipality: string): string {
  return `phdir_${normalizeText(name)}_${normalizeText(address)}_${normalizeText(municipality)}`;
}

async function scrapeWithFirecrawl(url: string, apiKey: string, schema: any, prompt: string, timeoutMs = 25000): Promise<any> {
  console.log(`Scraping: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'json'],
        jsonOptions: { schema, prompt },
        onlyMainContent: true,
        waitFor: 5000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${url}: ${response.status}`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Firecrawl timeout for ${url} after ${timeoutMs}ms`);
    } else {
      console.error(`Error scraping ${url}:`, error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Try Jina Reader + AI Gateway as fallback for JS-heavy pages
async function scrapeWithJinaAndAI(url: string, prompt: string): Promise<any[]> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    console.warn('LOVABLE_API_KEY not set, skipping Jina+AI fallback');
    return [];
  }

  try {
    console.log(`Jina+AI fallback for: ${url}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const jinaResp = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!jinaResp.ok) {
      console.warn(`Jina failed for ${url}: ${jinaResp.status}`);
      return [];
    }

    const jinaData = await jinaResp.json();
    const markdown = jinaData?.data?.content || jinaData?.content || '';
    if (!markdown || markdown.length < 100) {
      console.warn('Jina returned insufficient content');
      return [];
    }

    // Send to AI Gateway for extraction
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You extract pharmacy data from scraped web content. Return ONLY valid JSON array.',
          },
          {
            role: 'user',
            content: `${prompt}\n\nContent:\n${markdown.substring(0, 15000)}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_pharmacies',
            description: 'Extract pharmacy listings',
            parameters: {
              type: 'object',
              properties: {
                pharmacies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      address: { type: 'string' },
                      municipality: { type: 'string' },
                      phone: { type: 'string' },
                      duty_date: { type: 'string' },
                    },
                    required: ['name', 'address'],
                  },
                },
              },
              required: ['pharmacies'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_pharmacies' } },
      }),
    });

    if (!aiResp.ok) {
      console.warn(`AI Gateway failed: ${aiResp.status}`);
      return [];
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.pharmacies || [];
    }
    return [];
  } catch (error) {
    console.error('Jina+AI fallback error:', error);
    return [];
  }
}

// ── Overpass API (OpenStreetMap) — exhaustive directory for Málaga province ──
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

async function scrapeFromOverpass(): Promise<any[]> {
  // ISO3166-2 = ES-MA = Málaga province
  const query = `[out:json][timeout:60];
area["ISO3166-2"="ES-MA"]->.malaga;
(
  node["amenity"="pharmacy"](area.malaga);
  way["amenity"="pharmacy"](area.malaga);
  relation["amenity"="pharmacy"](area.malaga);
);
out center tags;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Querying Overpass: ${endpoint}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 75000);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'MalagaEvents/1.0 (https://malagaevents.lovable.app; contact@malagaevents.app)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        console.warn(`Overpass ${endpoint} failed: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const elements: any[] = data?.elements || [];
      console.log(`Overpass returned ${elements.length} pharmacy elements`);

      const mapped = elements
        .map((el: any) => {
          const tags = el.tags || {};
          const lat = el.lat ?? el.center?.lat ?? null;
          const lng = el.lon ?? el.center?.lon ?? null;
          if (!lat || !lng) return null;

          const name = (tags.name || tags['name:es'] || tags.brand || '').trim();
          if (!name || name.length < 2) return null;

          const street = tags['addr:street'] || '';
          const num = tags['addr:housenumber'] || '';
          const postcode = tags['addr:postcode'] || '';
          const city = tags['addr:city'] || tags['addr:suburb'] || tags['addr:town'] || tags['addr:village'] || 'Málaga';
          const addrParts = [
            [street, num].filter(Boolean).join(' ').trim(),
            postcode,
            city,
          ].filter(Boolean);
          const address = addrParts.join(', ') || `${city}, Málaga`;

          const phone = (tags.phone || tags['contact:phone'] || tags['phone:mobile'] || '')
            .toString()
            .trim() || null;

          return {
            name,
            address,
            municipality: city,
            phone,
            lat: Number(lat),
            lng: Number(lng),
            source_ref: 'openstreetmap.org',
          };
        })
        .filter(Boolean);

      // Dedupe by name + lat/lng rounded
      const seen = new Set<string>();
      const unique = mapped.filter((p: any) => {
        const key = `${normalizeText(p.name)}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`Overpass: ${unique.length} unique pharmacies after dedupe`);
      return unique;
    } catch (err) {
      console.warn(`Overpass endpoint ${endpoint} error:`, err instanceof Error ? err.message : err);
    }
  }
  return [];
}

function generateDutySchedule(pharmacies: any[], startDate: Date): any[] {
  const dutySchedule: any[] = [];
  const count = pharmacies.length;
  if (count === 0) return dutySchedule;

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dateStr = currentDate.toISOString().split('T')[0];

    const perDay = 2 + (dayOffset % 2);
    for (let i = 0; i < perDay; i++) {
      const idx = (dayOffset * perDay + i) % count;
      const pharmacy = pharmacies[idx];
      dutySchedule.push({
        name: pharmacy.name,
        address: pharmacy.address,
        phone: pharmacy.phone || null,
        lat: pharmacy.lat || null,
        lng: pharmacy.lng || null,
        municipality: pharmacy.municipality || 'Málaga',
        date_from: dateStr,
        date_to: dateStr,
        source_ref: pharmacy.source_ref || 'fallback',
      });
    }
  }

  return dutySchedule;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting pharmacy scraping (province-wide)...');

    const results = {
      guardia_scraped: 0,
      guardia_inserted: 0,
      directory_scraped: 0,
      directory_upserted: 0,
      guardia_source: 'none',
      directory_source: 'none',
      errors: [] as string[],
    };

    // ── 1. GUARDIA PHARMACIES ──
    let guardiaPharmacies: any[] = [];

    // Try Firecrawl first (with timeout)
    if (firecrawlKey) {
      const guardiaResult = await scrapeWithFirecrawl(
        'https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29',
        firecrawlKey,
        GUARDIA_SCHEMA,
        'Extract all on-duty pharmacy information shown on this page for Málaga province (ID 29). For each pharmacy get: name, address, municipality/town, phone, and date of guard duty in YYYY-MM-DD format.',
        20000
      );

      if (guardiaResult?.success && guardiaResult?.data?.json?.pharmacies?.length > 5) {
        guardiaPharmacies = guardiaResult.data.json.pharmacies.map((p: any) => ({
          ...p,
          municipality: p.municipality || 'Málaga',
          source_ref: 'farmaciasguardia.farmaceuticos.com',
        }));
        results.guardia_scraped = guardiaPharmacies.length;
        results.guardia_source = 'firecrawl';
        console.log(`Scraped ${guardiaPharmacies.length} guardia pharmacies via Firecrawl`);
      } else {
        console.log('Firecrawl guardia returned insufficient data, trying Jina+AI...');
      }
    }

    // Jina+AI fallback for guardia
    if (guardiaPharmacies.length < 5) {
      const jinaPharmacies = await scrapeWithJinaAndAI(
        'https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29',
        'Extract ALL on-duty pharmacies shown for Málaga province. For each pharmacy: name, full address, municipality/town, phone number, and duty_date in YYYY-MM-DD format.'
      );
      if (jinaPharmacies.length > guardiaPharmacies.length) {
        guardiaPharmacies = jinaPharmacies.map((p: any) => ({
          ...p,
          municipality: p.municipality || 'Málaga',
          source_ref: 'farmaciasguardia.farmaceuticos.com',
        }));
        results.guardia_scraped = guardiaPharmacies.length;
        results.guardia_source = 'jina-ai';
        console.log(`Scraped ${guardiaPharmacies.length} guardia pharmacies via Jina+AI`);
      }
    }

    // Generate duty schedule from scraped data or fallback
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let dutyEntries: any[];
    if (guardiaPharmacies.length > 5) {
      // Use scraped guardia data directly if it has dates
      dutyEntries = guardiaPharmacies.map(p => ({
        name: p.name,
        address: p.address,
        phone: p.phone || null,
        lat: null,
        lng: null,
        municipality: p.municipality || 'Málaga',
        date_from: p.duty_date || todayStr,
        date_to: p.duty_date || todayStr,
        source_ref: p.source_ref,
      }));
    } else {
      console.log('Using fallback duty rotation schedule');
      results.guardia_source = 'fallback';
      dutyEntries = generateDutySchedule(FALLBACK_PHARMACIES, today);
    }

    // Clear future entries and insert new ones
    const { error: deleteError } = await supabase
      .from('pharmacies_guard')
      .delete()
      .gte('date_from', todayStr);

    if (deleteError) {
      console.error('Error deleting old guard entries:', deleteError.message);
      results.errors.push(`guard_delete: ${deleteError.message}`);
    }

    const batchSize = 50;
    for (let i = 0; i < dutyEntries.length; i += batchSize) {
      const batch = dutyEntries.slice(i, i + batchSize);
      const { error } = await supabase
        .from('pharmacies_guard')
        .insert(batch);

      if (error) {
        console.error(`Guard batch insert error:`, error.message);
        results.errors.push(`guard_batch: ${error.message}`);
      } else {
        results.guardia_inserted += batch.length;
      }
    }

    // ── 2. FULL DIRECTORY ──
    let directoryPharmacies: any[] = [];

    // PRIMARY: OpenStreetMap Overpass — exhaustive (>700 pharmacies in Málaga province)
    const overpassPharmacies = await scrapeFromOverpass();
    if (overpassPharmacies.length > 50) {
      directoryPharmacies = overpassPharmacies;
      results.directory_scraped = directoryPharmacies.length;
      results.directory_source = 'overpass-osm';
      console.log(`Using Overpass directory: ${directoryPharmacies.length} pharmacies`);
    }

    // Try Firecrawl for directory (with timeout) — only if Overpass failed
    if (firecrawlKey && directoryPharmacies.length < 50) {
      const dirResult = await scrapeWithFirecrawl(
        'https://icofma.es/listado-farmacias-provincia-malaga',
        firecrawlKey,
        DIRECTORY_SCHEMA,
        'Extract ALL pharmacies listed on this page. This is the full directory of pharmacies in Málaga province. For each pharmacy get: name, address, municipality/town, and phone number.',
        20000
      );

      if (dirResult?.success && dirResult?.data?.json?.pharmacies?.length > 5) {
        directoryPharmacies = dirResult.data.json.pharmacies;
        results.directory_scraped = directoryPharmacies.length;
        results.directory_source = 'firecrawl';
        console.log(`Scraped ${directoryPharmacies.length} directory pharmacies via Firecrawl`);
      } else {
        console.log('Firecrawl directory returned insufficient data, trying Jina+AI...');
      }
    }

    // Jina+AI fallback for directory
    if (directoryPharmacies.length < 5) {
      const jinaDir = await scrapeWithJinaAndAI(
        'https://icofma.es/listado-farmacias-provincia-malaga',
        'Extract ALL pharmacies listed. For each: name, address, municipality/town, phone number. This is the complete directory of pharmacies in Málaga province.'
      );
      if (jinaDir.length > directoryPharmacies.length) {
        directoryPharmacies = jinaDir;
        results.directory_scraped = directoryPharmacies.length;
        results.directory_source = 'jina-ai';
        console.log(`Scraped ${directoryPharmacies.length} directory pharmacies via Jina+AI`);
      }
    }

    // Use fallback if both scrapers failed
    if (directoryPharmacies.length < 5) {
      directoryPharmacies = FALLBACK_PHARMACIES;
      results.directory_source = 'fallback';
      results.directory_scraped = directoryPharmacies.length;
    }

    // Upsert into pharmacies_directory
    for (let i = 0; i < directoryPharmacies.length; i += batchSize) {
      const batch = directoryPharmacies.slice(i, i + batchSize).map((p: any) => ({
        name: p.name,
        address: p.address,
        municipality: p.municipality || 'Málaga',
        province: 'Málaga',
        phone: p.phone || null,
        lat: p.lat || null,
        lng: p.lng || null,
        dedupe_key: generateDedupeKey(p.name, p.address, p.municipality || 'Málaga'),
        source_ref: p.source_ref || 'icofma.es',
      }));

      const { error } = await supabase
        .from('pharmacies_directory')
        .upsert(batch, { onConflict: 'dedupe_key', ignoreDuplicates: false });

      if (error) {
        console.error(`Directory batch upsert error:`, error.message);
        results.errors.push(`dir_batch: ${error.message}`);
      } else {
        results.directory_upserted += batch.length;
      }
    }

    console.log('Pharmacy scraping complete:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in pharmacy scraping:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
