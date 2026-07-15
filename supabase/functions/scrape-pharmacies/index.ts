import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  parseOfficialGuardHtml,
  dedupeGuardRows,
  buildOfficialUrl,
  type ParsedGuardRow,
} from './parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Curated list of province zones the official portal (Provincia_pNew.asp?id=29)
// exposes for Málaga. Extracted from the live form on 2026-07-15. Kept as a
// static list to make the crawler predictable and cachable.
const PROVINCE_ZONES: { id: string; label: string }[] = [
  { id: '29000085', label: 'Alameda' },
  { id: '29000024', label: 'Alcaucin' },
  { id: '29000025', label: 'Algarrobo' },
  { id: '29000079', label: 'Algatocin' },
  { id: '29000019', label: 'Alhaurin de la Torre' },
  { id: '29000075', label: 'Alhaurin el Grande' },
  { id: '29000026', label: 'Almachar' },
  { id: '29000027', label: 'Almargen' },
  { id: '29000028', label: 'Almogia' },
  { id: '29000003', label: 'Alora' },
  { id: '29000071', label: 'Alozaina, El burgo, Tolox, Yunquera y Casarabonela' },
  { id: '29000029', label: 'Alpandeire' },
  { id: '29000011', label: 'Antequera' },
  { id: '29000030', label: 'Archez' },
  { id: '29000070', label: 'Archidona' },
  { id: '29000072', label: 'Ardales - Carratraca' },
  { id: '29000031', label: 'Arenas' },
  { id: '29000032', label: 'Arriate' },
  { id: '29000033', label: 'Atalajate' },
  { id: '29000080', label: 'Benadalid' },
  { id: '29000023', label: 'Benahavis' },
  { id: '29000083', label: 'Benalauria' },
  { id: '29000018', label: 'Benalmadena' },
  { id: '29000034', label: 'Benamargosa' },
  { id: '29000035', label: 'Benamocarra' },
  { id: '29000082', label: 'Benarraba' },
  { id: '29000087', label: 'Campillos' },
  { id: '29000037', label: 'Canillas de Aceituno' },
  { id: '29000073', label: 'Canillas de Albaida' },
  { id: '29000038', label: 'Cañete La Real' },
  { id: '29000039', label: 'Cartajima' },
  { id: '29000010', label: 'Cartama' },
  { id: '29000077', label: 'Cartaojal' },
  { id: '29000004', label: 'Casabermeja - Riogordo - Colmenar' },
  { id: '29000076', label: 'Coin' },
  { id: '29000040', label: 'Comares' },
  { id: '29000090', label: 'Competa' },
  { id: '29000015', label: 'Cortes - Montejaque - Jimera - Benaojan' },
  { id: '29000041', label: 'Cuevas Bajas' },
  { id: '29000091', label: 'Cuevas de San Marcos.' },
  { id: '29000042', label: 'Cuevas del Becerro' },
  { id: '29000043', label: 'Cutar' },
  { id: '29000067', label: 'El Borge' },
  { id: '29000036', label: 'El Burgo' },
  { id: '29000020', label: 'Estepona' },
  { id: '29000044', label: 'Farajan' },
  { id: '29000045', label: 'Frigiliana' },
  { id: '29000069', label: 'Fuengirola - Mijas' },
  { id: '29000046', label: 'Gaucin' },
  { id: '29000081', label: 'Genalguacil' },
  { id: '29000047', label: 'Guaro' },
  { id: '29000005', label: 'Humilladero - Mollina - Fuente Piedra' },
  { id: '29000048', label: 'Igualeja' },
  { id: '29000022', label: 'Istan' },
  { id: '29000049', label: 'Iznate' },
  { id: '29000078', label: 'Jubrique' },
  { id: '29000050', label: 'Juzcar' },
  { id: '29000065', label: 'La Viñuela' },
  { id: '29000051', label: 'Macharaviaya' },
  { id: '29000001', label: 'Málaga capital' },
  { id: '29000002', label: 'Malnilva' },
  { id: '29000068', label: 'Marbella' },
  { id: '29000084', label: 'Mijas' },
  { id: '29000052', label: 'Moclinejo' },
  { id: '29000053', label: 'Monda' },
  { id: '29000092', label: 'Montecorto' },
  { id: '29000008', label: 'Nerja' },
  { id: '29000021', label: 'Ojen' },
  { id: '29000054', label: 'Parauta' },
  { id: '29000055', label: 'Periana' },
  { id: '29000007', label: 'Pizarra' },
  { id: '29000056', label: 'Pujerra' },
  { id: '29000014', label: 'Ricon de la Victoria' },
  { id: '29000009', label: 'Ronda' },
  { id: '29000057', label: 'Salares' },
  { id: '29000017', label: 'San Pedro Alcantara' },
  { id: '29000058', label: 'Sayalonga' },
  { id: '29000059', label: 'Sedella' },
  { id: '29000093', label: 'Serrato' },
  { id: '29000060', label: 'Sierra de Yeguas' },
  { id: '29000074', label: 'Teba' },
  { id: '29000013', label: 'Torre del Mar' },
  { id: '29000006', label: 'Torremolinos' },
  { id: '29000086', label: 'Torrox - Torrox Costa' },
  { id: '29000061', label: 'Totalan' },
  { id: '29000062', label: 'Valle de Abdalajis' },
  { id: '29000012', label: 'Velez - Malaga' },
  { id: '29000016', label: 'Villanueva de Algaidas' },
  { id: '29000094', label: 'Villanueva de la Concepcion' },
  { id: '29000064', label: 'Villanueva de Tapia' },
  { id: '29000063', label: 'Villanueva del Rosario' },
  { id: '29000088', label: 'Villanueva del Trabuco' },
  { id: '29000066', label: 'Yunquera' },
];

const OFFICIAL_HOST = 'farmaciasguardia.farmaceuticos.com';
const FORM_URL = `https://${OFFICIAL_HOST}/web_guardias/publico/Provincia_pNew.asp?id=29`;
const USER_AGENT =
  'Mozilla/5.0 (compatible; MalagaEventsGuardBot/1.0; +https://malagaevents.lovable.app)';

// windows-1252 → utf8 decode via TextDecoder
async function fetchTextLatin1(url: string, headers: HeadersInit): Promise<{ status: number; text: string }> {
  const resp = await fetch(url, { headers, redirect: 'follow' });
  const buf = new Uint8Array(await resp.arrayBuffer());
  // Portal declares windows-1252; latin1 is close enough for our field extraction
  // (accents survive intact for the patterns we match).
  const text = new TextDecoder('windows-1252').decode(buf);
  return { status: resp.status, text };
}

async function fetchOfficialForZone(
  zoneId: string,
  dateISO: string,
  cookie: string
): Promise<{ url: string; ok: boolean; status: number; text: string }> {
  const url = buildOfficialUrl(zoneId, dateISO);
  const { status, text } = await fetchTextLatin1(url, {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Referer': FORM_URL,
    'Cookie': cookie,
  });
  return { url, ok: status >= 200 && status < 400, status, text };
}

/** Get the ASP session cookie by visiting the form page once. */
async function primeSession(): Promise<string> {
  const resp = await fetch(FORM_URL, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
    redirect: 'manual',
  });
  await resp.arrayBuffer(); // drain
  const setCookie = resp.headers.get('set-cookie') || '';
  const match = setCookie.match(/ASPSESSIONID[A-Z]+=[^;]+/);
  return match ? match[0] : '';
}

// Ingestion allowlist for pharmacies_guard.source_ref — must match the DB
// trigger (pharmacies_guard_enforce_official_source). Enforced client-side
// as defense in depth using exact hostname.
const ALLOWED_HOSTS = new Set([
  'farmaciasguardia.farmaceuticos.com',
  'farmaceuticos.com',
  'icofma.es',
  'cofmalaga.com',
  'cgcof.es',
]);

function isAllowedSource(sourceRef: string): boolean {
  try {
    const u = new URL(sourceRef);
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.has(host) || [...ALLOWED_HOSTS].some((h) => host.endsWith(`.${h}`));
  } catch {
    // Fallback for legacy plain-domain values: still whitelist by substring.
    return [...ALLOWED_HOSTS].some((h) => sourceRef.toLowerCase().includes(h));
  }
}

function todayInMadrid(): string {
  // Europe/Madrid calendar day, no libs.
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const params = url.searchParams;
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch { body = {}; }
    }
    const dateISO = (params.get('date') || (body.date as string) || todayInMadrid()).slice(0, 10);
    const zonesLimit = Number(params.get('zonesLimit') || body.zonesLimit || 0) || undefined;
    const onlyZoneId = params.get('zone') || (body.zone as string) || undefined;
    const dryRun = params.get('dryRun') === '1' || body.dryRun === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[scrape-pharmacies] start date=${dateISO} zonesLimit=${zonesLimit ?? 'all'} zone=${onlyZoneId ?? '*'} dryRun=${dryRun}`);

    const results = {
      date: dateISO,
      status: 'official_data_unavailable' as
        | 'official_data_unavailable'
        | 'official_data_available'
        | 'sync_error',
      zones_queried: 0,
      zones_with_data: 0,
      zones_empty: 0,
      zones_failed: 0,
      guardia_inserted: 0,
      per_municipality: {} as Record<string, number>,
      errors: [] as string[],
      updated_at: new Date().toISOString(),
    };

    const cookie = await primeSession();
    if (!cookie) console.warn('[scrape-pharmacies] no session cookie obtained (portal may still work)');

    const zonesToQuery = onlyZoneId
      ? PROVINCE_ZONES.filter((z) => z.id === onlyZoneId)
      : (zonesLimit ? PROVINCE_ZONES.slice(0, zonesLimit) : PROVINCE_ZONES);

    const collected: ParsedGuardRow[] = [];

    for (const zone of zonesToQuery) {
      results.zones_queried += 1;
      try {
        const r = await fetchOfficialForZone(zone.id, dateISO, cookie);
        if (!r.ok) {
          results.zones_failed += 1;
          results.errors.push(`zone_${zone.id}_http_${r.status}`);
          continue;
        }
        const parsed = parseOfficialGuardHtml(r.text, {
          source_ref: r.url,
          duty_date: dateISO,
          zone_label: zone.label,
        });
        if (!parsed.available || parsed.rows.length === 0) {
          results.zones_empty += 1;
          continue;
        }
        // Whitelist enforcement per row
        const safeRows = parsed.rows.filter((row) => isAllowedSource(row.source_ref));
        if (safeRows.length > 0) {
          results.zones_with_data += 1;
          collected.push(...safeRows);
        }
      } catch (err) {
        results.zones_failed += 1;
        results.errors.push(`zone_${zone.id}_err_${err instanceof Error ? err.message : 'unknown'}`);
      }
      // gentle throttle so we don't hammer the ASP server
      await new Promise((res) => setTimeout(res, 40));
    }

    const deduped = dedupeGuardRows(collected);
    for (const r of deduped) {
      results.per_municipality[r.municipality] = (results.per_municipality[r.municipality] || 0) + 1;
    }

    console.log(`[scrape-pharmacies] parsed=${collected.length} unique=${deduped.length} municipalities=${Object.keys(results.per_municipality).length}`);

    if (deduped.length > 0) {
      results.status = 'official_data_available';

      if (!dryRun) {
        // Only touch rows for the SPECIFIC target date; preserve everything else.
        const { error: delErr } = await supabase
          .from('pharmacies_guard')
          .delete()
          .eq('date_from', dateISO)
          .eq('date_to', dateISO);
        if (delErr) results.errors.push(`delete_${delErr.message}`);

        const batchSize = 100;
        const payload = deduped.map((r) => ({
          name: r.name,
          address: r.address,
          phone: null,
          lat: null,
          lng: null,
          municipality: r.municipality,
          date_from: r.duty_date,
          date_to: r.duty_date,
          source_ref: r.source_ref,
        }));
        for (let i = 0; i < payload.length; i += batchSize) {
          const batch = payload.slice(i, i + batchSize);
          const { error } = await supabase.from('pharmacies_guard').insert(batch);
          if (error) {
            results.errors.push(`insert_${error.message}`);
          } else {
            results.guardia_inserted += batch.length;
          }
        }
      }
    } else {
      // Honest failure signal: distinguish "no data" from "sync error".
      results.status = results.zones_failed > 0 && results.zones_with_data === 0
        ? 'sync_error'
        : 'official_data_unavailable';
      console.warn('[scrape-pharmacies] no verifiable rows, preserving existing DB state');
    }

    // Persist sync status
    try {
      await supabase.from('app_config').upsert(
        {
          key: 'pharmacies_guard_last_sync',
          value: {
            ...results,
            guardia_source: results.status === 'official_data_available'
              ? 'farmaciasguardia.farmaceuticos.com'
              : 'none',
            source_form_url: FORM_URL,
          },
        },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.warn('[scrape-pharmacies] app_config upsert failed:', e);
    }

    return new Response(
      JSON.stringify({ success: true, ...results, sample: deduped.slice(0, 5) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[scrape-pharmacies] fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
