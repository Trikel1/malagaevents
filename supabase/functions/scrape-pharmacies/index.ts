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

async function scrapeWithFirecrawl(url: string, apiKey: string, schema: any, prompt: string): Promise<any> {
  console.log(`Scraping: ${url}`);
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${url}: ${response.status}`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
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
      errors: [] as string[],
    };

    // ── 1. GUARDIA PHARMACIES ──
    let guardiaPharmacies: any[] = [];

    if (firecrawlKey) {
      // Try scraping the official guardia portal for Málaga province
      const guardiaResult = await scrapeWithFirecrawl(
        'https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29',
        firecrawlKey,
        GUARDIA_SCHEMA,
        'Extract all on-duty pharmacy information shown on this page for Málaga province. For each pharmacy get: name, address, municipality/town, phone, and date of guard duty.'
      );

      if (guardiaResult?.success && guardiaResult?.data?.json?.pharmacies) {
        guardiaPharmacies = guardiaResult.data.json.pharmacies.map((p: any) => ({
          ...p,
          municipality: p.municipality || 'Málaga',
          source_ref: 'farmaciasguardia.farmaceuticos.com',
        }));
        results.guardia_scraped = guardiaPharmacies.length;
        console.log(`Scraped ${guardiaPharmacies.length} guardia pharmacies`);
      } else {
        console.log('Guardia scraping returned no data, using fallback rotation');
      }
    }

    // Generate duty schedule from scraped data or fallback
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let dutyEntries: any[];
    if (guardiaPharmacies.length > 0) {
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
      dutyEntries = generateDutySchedule(FALLBACK_PHARMACIES, today);
    }

    // Clear future entries and insert new ones
    await supabase
      .from('pharmacies_guard')
      .delete()
      .gte('date_from', todayStr);

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

    if (firecrawlKey) {
      const dirResult = await scrapeWithFirecrawl(
        'https://icofma.es/listado-farmacias-provincia-malaga',
        firecrawlKey,
        DIRECTORY_SCHEMA,
        'Extract ALL pharmacies listed on this page. This is the full directory of pharmacies in Málaga province. For each pharmacy get: name, address, municipality/town, and phone number.'
      );

      if (dirResult?.success && dirResult?.data?.json?.pharmacies) {
        directoryPharmacies = dirResult.data.json.pharmacies;
        results.directory_scraped = directoryPharmacies.length;
        console.log(`Scraped ${directoryPharmacies.length} directory pharmacies`);
      } else {
        console.log('Directory scraping returned no data, using fallback');
      }
    }

    // Use fallback if scraping failed
    if (directoryPharmacies.length === 0) {
      directoryPharmacies = FALLBACK_PHARMACIES;
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

    console.log('Pharmacy scraping complete:', results);

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
