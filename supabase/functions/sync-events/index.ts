import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// SECURITY: Strict CORS + Security Headers
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://id-preview--e27fc85d-8f7a-4dbf-a4f6-bc1aa35b0665.lovable.app',
  'https://lovable.dev',
  'http://localhost:5173',
];

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function getAllHeaders(origin?: string | null): Record<string, string> {
  return {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
}

// Rate limiting for sync endpoint (prevent abuse)
const syncRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isSyncRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = syncRateLimitMap.get(identifier);
  const limit = 10; // max 10 syncs per hour
  const window = 3600000;

  if (!record || now > record.resetAt) {
    syncRateLimitMap.set(identifier, { count: 1, resetAt: now + window });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count++;
  return false;
}

// SSRF prevention - only allow scraping from approved domains
const ALLOWED_SCRAPING_DOMAINS = [
  'teatrocervantes.com',
  'teatroechegaray.es', 
  'teatrodelsoho.com',
  'lacocheracabaret.com',
  'salatrinchera.com',
  'paris15.es',
  'antojo.es',
  'antojomalaga.es',
  'salamarte.com',
  'salamartemalaga.com',
  'eventual.es',
  'eventualmusic.com',
  'latermica.com',
  'latermicamalaga.com',
  'firecrawl.dev',
  'api.firecrawl.dev',
  // Phase 2 additions
  'malaga.eu',
  'cultura.malaga.eu',
  'fycma.com',
  'festivaldemalaga.com',
  'instagram.com',
  'facebook.com',
  'mmalaga.es',
  'lafabricadecerveza.com',
  'barlagarrapata.com',
];

function isUrlAllowedForScraping(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Only HTTPS (except for Firecrawl API)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Block private IPs and metadata endpoints
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /metadata/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    // Check against allowlist
    return ALLOWED_SCRAPING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// SOURCE-SPECIFIC CONFIGURATION
// ============================================================================

interface SourceConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  requestDelayMs: number;
  jitterMs: number;
  connectTimeoutMs: number;
  readTimeoutMs: number;
  totalTimeoutMs: number;
  useHeadless: boolean;
  alternativeEndpoint?: string;
}

const DEFAULT_CONFIG: SourceConfig = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 16000,
  requestDelayMs: 2000,
  jitterMs: 500,
  connectTimeoutMs: 10000,
  readTimeoutMs: 30000,
  totalTimeoutMs: 45000,
  useHeadless: false,
};

// Problematic sources get special treatment - use simpler scraping
const SOURCE_CONFIGS: Record<string, Partial<SourceConfig>> = {
  'teatro-cervantes': {
    maxRetries: 3,
    initialDelayMs: 2000,
    requestDelayMs: 3000,
    jitterMs: 500,
    totalTimeoutMs: 45000,
    useHeadless: false,
  },
  'paris-15': {
    maxRetries: 2,
    initialDelayMs: 1500,
    requestDelayMs: 2000,
    jitterMs: 500,
    totalTimeoutMs: 30000,
    useHeadless: false,
    alternativeEndpoint: 'https://paris15.es/wp-json/tribe/events/v1/events',
  },
  'la-cochera-cabaret': {
    maxRetries: 2,
    totalTimeoutMs: 30000,
    useHeadless: false,
    alternativeEndpoint: 'https://lacocheracabaret.com/wp-json/tribe/events/v1/events',
  },
  'la-termica': {
    maxRetries: 2,
    totalTimeoutMs: 30000,
    useHeadless: false,
  },
  // Phase 2 sources
  'agenda-municipal': {
    maxRetries: 2,
    totalTimeoutMs: 45000,
    useHeadless: false,
  },
  'cultura-malaga': {
    maxRetries: 2,
    totalTimeoutMs: 45000,
    useHeadless: false,
  },
  'fycma': {
    maxRetries: 2,
    totalTimeoutMs: 30000,
    useHeadless: false,
  },
  'festival-malaga': {
    maxRetries: 2,
    totalTimeoutMs: 30000,
    useHeadless: false,
  },
  'la-garrapata': {
    maxRetries: 1, // Best-effort only
    totalTimeoutMs: 15000,
    useHeadless: false,
  },
};

function getSourceConfig(slug: string): SourceConfig {
  return { ...DEFAULT_CONFIG, ...SOURCE_CONFIGS[slug] };
}

// ============================================================================
// VENUE AND LOCATION NORMALIZATION
// ============================================================================

const VENUE_ALIASES: Record<string, string> = {
  // Teatros (only 3)
  'teatro del soho': 'Teatro del Soho CaixaBank',
  'teatro soho': 'Teatro del Soho CaixaBank',
  'soho caixabank': 'Teatro del Soho CaixaBank',
  'soho': 'Teatro del Soho CaixaBank',
  'teatro cervantes': 'Teatro Cervantes',
  'cervantes': 'Teatro Cervantes',
  'teatro echegaray': 'Teatro Echegaray',
  'echegaray': 'Teatro Echegaray',
  // Salas - La Cochera Cabaret (aliases)
  'la cochera cabaret': 'La Cochera Cabaret',
  'cochera cabaret': 'La Cochera Cabaret',
  'la cochera': 'La Cochera Cabaret',
  'cochera': 'La Cochera Cabaret',
  // Salas - Sala Trinchera (aliases)
  'sala trinchera': 'Sala Trinchera',
  'trinchera': 'Sala Trinchera',
  'la trinchera': 'Sala Trinchera',
  // Otras salas
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
  // Phase 2 venues
  'fycma': 'FYCMA - Palacio de Ferias y Congresos',
  'palacio de ferias': 'FYCMA - Palacio de Ferias y Congresos',
  'palacio ferias malaga': 'FYCMA - Palacio de Ferias y Congresos',
  'palacio de ferias y congresos': 'FYCMA - Palacio de Ferias y Congresos',
  'la garrapata': 'La Garrapata',
  'bar la garrapata': 'La Garrapata',
  'garrapata': 'La Garrapata',
  'la caja blanca': 'La Caja Blanca',
  'caja blanca': 'La Caja Blanca',
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
          image_url: { type: 'string', description: 'IMPORTANT: Main event poster/image URL. Look for og:image meta tag, large hero images, or event-specific images. Avoid logos, icons, or small thumbnails.' },
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
// DIAGNOSTIC LOGGER
// ============================================================================

interface DiagnosticEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  phase: 'init' | 'scrape' | 'parse' | 'persist' | 'complete';
  message: string;
  details?: any;
}

class DiagnosticLogger {
  private logs: DiagnosticEntry[] = [];
  private currentSource: string = 'main';
  private urlExamples: { listado?: string; fichaOk?: string; fichaFail?: string } = {};

  setSource(source: string) {
    this.currentSource = source;
    this.urlExamples = {};
  }

  log(level: DiagnosticEntry['level'], phase: DiagnosticEntry['phase'], message: string, details?: any) {
    const entry: DiagnosticEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: this.currentSource,
      phase,
      message,
      details,
    };
    this.logs.push(entry);
    
    const prefix = `[${level.toUpperCase()}][${this.currentSource}][${phase}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`, details ? JSON.stringify(details).substring(0, 200) : '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, details ? JSON.stringify(details).substring(0, 200) : '');
    } else {
      console.log(`${prefix} ${message}`, details ? JSON.stringify(details).substring(0, 100) : '');
    }
  }

  info(phase: DiagnosticEntry['phase'], message: string, details?: any) {
    this.log('info', phase, message, details);
  }

  warn(phase: DiagnosticEntry['phase'], message: string, details?: any) {
    this.log('warn', phase, message, details);
  }

  error(phase: DiagnosticEntry['phase'], message: string, details?: any) {
    this.log('error', phase, message, details);
  }

  debug(phase: DiagnosticEntry['phase'], message: string, details?: any) {
    this.log('debug', phase, message, details);
  }

  setUrlExample(type: 'listado' | 'fichaOk' | 'fichaFail', url: string) {
    this.urlExamples[type] = url;
  }

  getUrlExamples() {
    return this.urlExamples;
  }

  getLogs() {
    return this.logs;
  }

  getLogsForSource(source: string) {
    return this.logs.filter(l => l.source === source);
  }

  getErrorSummary() {
    return this.logs
      .filter(l => l.level === 'error')
      .map(l => ({ source: l.source, phase: l.phase, message: l.message }));
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
    // Accept HH:MM, HH.MM, "20h", "20 h", "20:00 h"
    const timeMatch = timeText.match(/(\d{1,2})(?:[:\.](\d{2}))?\s*h?/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    }
  }
  
  // ISO first (YYYY-MM-DD or full ISO)
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const h = isoMatch[4] ? parseInt(isoMatch[4]) : hour;
    const m = isoMatch[5] ? parseInt(isoMatch[5]) : minute;
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), h, m);
  }
  
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
  
  // DD/MM/YYYY or DD-MM-YYYY
  const numericMatch = dateText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1;
    let year = parseInt(numericMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day, hour, minute);
  }
  
  // DD/MM only — infer year (next future occurrence)
  const shortMatch = dateText.match(/^\s*(\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (shortMatch) {
    const day = parseInt(shortMatch[1]);
    const month = parseInt(shortMatch[2]) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const now = new Date();
      let year = now.getFullYear();
      let date = new Date(year, month, day, hour, minute);
      // If already past by more than 1 day, assume next year
      if (date.getTime() < now.getTime() - 24 * 3600 * 1000) {
        date = new Date(year + 1, month, day, hour, minute);
      }
      return date;
    }
  }
  
  return null;
}

/**
 * Decode HTML entities to readable characters
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Numeric entities (hex)
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanTitle(title: string): string {
  if (!title) return '';
  return decodeHtmlEntities(title)
    .replace(/\[.*?\]/g, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function isValidEventTitle(title: string): boolean {
  if (!title || title.length < 3 || title.length > 200) return false;
  
  // Reject titles containing URLs (bad parsing artifact)
  if (/\(https?:\/\//.test(title) || /^https?:\/\//.test(title)) return false;
  
  // Reject cookie/legal/navigation junk anywhere in title
  if (/uso de cookies|aviso legal|política de privacidad|cookie policy|privacy policy/i.test(title)) return false;
  
  const invalidPatterns = [
    /^(menu|menú|inicio|home|contacto|contact|about|cookies|privacidad|legal|newsletter)/i,
    /^(ver más|leer más|read more|see more|siguiente|anterior|next|prev)/i,
    /^(aceptar|rechazar|cerrar|close|accept|reject|ok|cancel)/i,
    /^(agenda|programación|programa|calendar|eventos|events)$/i,
    /^(facebook|twitter|instagram|youtube|linkedin|tiktok)/i,
    /^(reservar|comprar|buy|book|tickets|entradas)$/i,
    /^(suscríbete|subscribe|sign up|registr)/i,
    /^(navigation|nav|sidebar|footer|header|breadcrumb)/i,
    /^\(\!\)/,
    /^\d+$/,
    /^[^a-záéíóúñ]+$/i,
    /^(nombre del evento|event title|evento ejemplo|evento \d)/i,
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
  
  // Comedy - check first as it's specific
  if (/comedia|comedy|monólogo|monologo|humor|stand.?up|risas|humorista/i.test(text)) return 'comedy';
  
  // Festival
  if (/festival/i.test(text)) return 'festival';
  
  // Exhibitions / Art
  if (/exposici[oó]n|exposicion|muestra|galer[ií]a|galeria|museo|arte\s|artista/i.test(text)) return 'exhibitions';
  
  // Kids / Family
  if (/infantil|ni[ñn]os|ninos|familia|familiar|peque[ñn]os|pequenos|cuentacuentos|títeres|titeres|marionetas/i.test(text)) return 'kids';
  
  // Sports
  if (/carrera|marat[oó]n|maraton|partido|campeonato|deporte|deportivo|atletismo|ciclismo/i.test(text)) return 'sports';
  
  // Workshops
  if (/taller\b|curso\b|clase\b|masterclass|formaci[oó]n|formacion|workshop/i.test(text)) return 'workshops';
  
  // Conferences
  if (/conferencia|charla|ponencia|congreso|seminario|coloquio|mesa\s+redonda/i.test(text)) return 'conferences';
  
  // Theater / Dance / Circus
  if (/teatro|theatre|obra\s|musical|danza|dance|circo|circus|ballet|flamenco|dramaturgia/i.test(text)) return 'theater';
  
  // Nightlife
  if (/dj\b|disco|fiesta|party|club|noche|nocturno|after/i.test(text)) return 'nightlife';
  
  // Music - check last as it's broad
  if (/concierto|concert|música|musica|music|banda|band|live|directo|orquesta|sinfónic/i.test(text)) return 'music';
  
  return sourceEventType || 'other';
}

// Validate if an image URL is accessible and returns an image content-type
async function validateImageUrl(url: string): Promise<boolean> {
  if (!url) return false;
  
  // Skip validation for known problematic patterns
  if (/logo|icon|favicon|placeholder|default|avatar/i.test(url)) return false;
  if (url.startsWith('data:')) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MalagaEvents/1.0)',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return false;
    
    const contentType = response.headers.get('content-type');
    return contentType?.startsWith('image/') || false;
  } catch {
    return false;
  }
}

function addJitter(baseMs: number, jitterMs: number): number {
  return baseMs + Math.floor(Math.random() * jitterMs * 2) - jitterMs;
}

// ============================================================================
// DIRECT FETCHERS (HTML/RSS/JSON-LD) — tried before Firecrawl
// ============================================================================

const UA = 'Mozilla/5.0 (compatible; MalagaEventsBot/1.0; +https://malagaevents.lovable.app)';

interface NormalizedEvent {
  title: string;
  description?: string;
  occurrences: Array<{ date: string; time?: string; end_time?: string }>;
  venue?: string;
  city?: string;
  image_url?: string;
  ticket_url?: string;
  price?: string;
  is_free?: boolean;
}

interface DirectFetchResult {
  ok: boolean;
  http_status?: number;
  events: NormalizedEvent[];
  strategy: string;
  error?: string;
}

async function fetchWithTimeout(url: string, ms = 15000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(init.headers || {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Extract events from any HTML via JSON-LD <script> blocks */
function extractJsonLdEvents(html: string, baseUrl: string): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    let data: any;
    try { data = JSON.parse(raw); } catch { continue; }
    const queue: any[] = Array.isArray(data) ? [...data] : [data];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph']);
      const t = node['@type'];
      const types = Array.isArray(t) ? t : [t];
      if (!types.some((x: any) => typeof x === 'string' && /Event/i.test(x))) continue;
      const title = node.name || node.headline;
      const start = node.startDate;
      if (!title || !start) continue;
      const date = String(start).split('T')[0];
      const timeMatch = String(start).match(/T(\d{2}:\d{2})/);
      const venue = node.location?.name || undefined;
      const city = node.location?.address?.addressLocality || undefined;
      const img = Array.isArray(node.image) ? node.image[0] : (node.image?.url || node.image);
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      out.push({
        title: cleanTitle(String(title)),
        description: node.description ? String(node.description).substring(0, 500) : undefined,
        occurrences: [{ date, time: timeMatch?.[1] }],
        venue,
        city,
        image_url: typeof img === 'string' ? normalizeImageUrl(img, baseUrl) : undefined,
        ticket_url: offer?.url || node.url,
        price: offer?.price !== undefined ? String(offer.price) : undefined,
        is_free: offer?.price === 0 || offer?.price === '0',
      });
    }
  }
  return out;
}

const SPANISH_MONTHS_SHORT: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};
const SPANISH_MONTHS_LONG: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Paris 15: parse qodef-event-content cards */
async function fetchParis15Cards(): Promise<DirectFetchResult> {
  try {
    const r = await fetchWithTimeout('https://paris15.es/eventos/', 20000);
    if (!r.ok) return { ok: false, http_status: r.status, events: [], strategy: 'paris15-cards', error: `HTTP ${r.status}` };
    const html = await r.text();
    const events: NormalizedEvent[] = [];
    const cardRe = /<div class="qodef-event-content qodef-events\d+"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null) {
      const card = m[1];
      const day = card.match(/qodef-event-day-number-holder">\s*(\d{1,2})/)?.[1];
      const monthStr = card.match(/qodef-event-day-holder">\s*(\w+)/)?.[1]?.toLowerCase().substring(0, 3);
      const titleHref = card.match(/<a href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/);
      const ticketHref = card.match(/qodef-event-buy-tickets-button"[^>]*?href="([^"]+)"|<a href="([^"]+)"[^>]*class="qodef-event-buy-tickets-button/);
      const ticketUrl = ticketHref?.[1] || ticketHref?.[2];
      if (!day || !monthStr || !titleHref) continue;
      const month = SPANISH_MONTHS_SHORT[monthStr];
      if (!month) continue;
      const dd = day.padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      events.push({
        title: cleanTitle(titleHref[2]),
        occurrences: [{ date: `${dd}/${mm}`, time: '21:00' }],
        venue: 'París 15',
        city: 'Málaga',
        ticket_url: ticketUrl || titleHref[1],
      });
    }
    return { ok: true, http_status: 200, events, strategy: 'paris15-cards' };
  } catch (e) {
    return { ok: false, events: [], strategy: 'paris15-cards', error: e instanceof Error ? e.message : String(e) };
  }
}

/** La Cochera Cabaret: parse event_brick cards */
async function fetchCocheraCards(): Promise<DirectFetchResult> {
  try {
    const r = await fetchWithTimeout('https://lacocheracabaret.com/programacion/', 20000);
    if (!r.ok) return { ok: false, http_status: r.status, events: [], strategy: 'cochera-cards', error: `HTTP ${r.status}` };
    const html = await r.text();
    const events: NormalizedEvent[] = [];
    // pattern: event_brick_date "DD mes YYYY" + post_item_title <a href>title</a>
    const cardRe = /event_brick_date">\s*[^,]*,?\s*(\d{1,2})\s+(\w+)\s+(\d{4})\s*<\/div>\s*<div class="post_item_title">\s*<a href="([^"]+)">\s*([^<]+?)\s*<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null) {
      const day = m[1].padStart(2, '0');
      const monthName = m[2].toLowerCase();
      const month = SPANISH_MONTHS_LONG[monthName] || SPANISH_MONTHS_SHORT[monthName.substring(0, 3)];
      if (!month) continue;
      const mm = String(month).padStart(2, '0');
      const year = m[3];
      events.push({
        title: cleanTitle(m[5]),
        occurrences: [{ date: `${day}/${mm}/${year}`, time: '21:00' }],
        venue: 'La Cochera Cabaret',
        city: 'Málaga',
        ticket_url: m[4],
      });
    }
    return { ok: true, http_status: 200, events, strategy: 'cochera-cards' };
  } catch (e) {
    return { ok: false, events: [], strategy: 'cochera-cards', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sala Trinchera: RSS with `<title>DD/MM Título</title>` */
async function fetchTrincheraRSS(): Promise<DirectFetchResult> {
  const url = 'https://salatrinchera.com/category/proximos-eventos/feed/';
  try {
    const r = await fetchWithTimeout(url, 12000);
    if (!r.ok) return { ok: false, http_status: r.status, events: [], strategy: 'trinchera-rss', error: `HTTP ${r.status}` };
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const events: NormalizedEvent[] = [];
    for (const item of items) {
      const titleRaw = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
      const desc = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim();
      const decoded = decodeHtmlEntities(titleRaw);
      const dateMatch = decoded.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
      if (!dateMatch) continue;
      const dd = dateMatch[1].padStart(2, '0');
      const mm = dateMatch[2].padStart(2, '0');
      events.push({
        title: cleanTitle(dateMatch[3]),
        description: desc ? decodeHtmlEntities(desc).replace(/<[^>]*>/g, '').substring(0, 400) : undefined,
        occurrences: [{ date: `${dd}/${mm}`, time: '21:00' }],
        venue: 'Sala Trinchera',
        city: 'Málaga',
        ticket_url: link,
      });
    }
    return { ok: true, http_status: 200, events, strategy: 'trinchera-rss' };
  } catch (e) {
    return { ok: false, events: [], strategy: 'trinchera-rss', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Generic HTML + JSON-LD fetcher */
async function fetchGenericHTML(url: string, defaultVenue: string, strategyTag: string): Promise<DirectFetchResult> {
  try {
    const r = await fetchWithTimeout(url, 20000);
    if (!r.ok) return { ok: false, http_status: r.status, events: [], strategy: strategyTag, error: `HTTP ${r.status}` };
    const html = await r.text();
    const events = extractJsonLdEvents(html, url);
    for (const e of events) if (!e.venue) e.venue = defaultVenue;
    return { ok: true, http_status: r.status, events, strategy: strategyTag };
  } catch (e) {
    return { ok: false, events: [], strategy: strategyTag, error: e instanceof Error ? e.message : String(e) };
  }
}

async function tryDirectFetcher(slug: string, source: any): Promise<DirectFetchResult | null> {
  switch (slug) {
    case 'sala-trinchera':
      return fetchTrincheraRSS();
    case 'paris-15':
      return fetchParis15Cards();
    case 'sala-marte':
      return fetchGenericHTML('https://salamartemalaga.com/eventos/', 'Sala Marte', 'salamarte-html-jsonld');
    case 'la-cochera-cabaret':
      return fetchCocheraCards();
    case 'teatro-soho':
      return fetchGenericHTML(source.chosen_entrypoint || 'https://teatrodelsoho.com/programacion/', 'Teatro del Soho CaixaBank', 'soho-html-jsonld');
    case 'teatro-cervantes':
      return fetchGenericHTML('https://www.teatrocervantes.com/es/programacion/', 'Teatro Cervantes', 'cervantes-html-jsonld');
    case 'eventual-music':
      return fetchGenericHTML('https://www.eventualmusic.com/programacion.php', 'Sala Eventual', 'eventual-html-jsonld');
    case 'antojo-malaga':
      return fetchGenericHTML('https://antojomalaga.es/programacion', 'Antojo Málaga', 'antojo-html-jsonld');
    default:
      return null;
  }
}

/** Mark stuck `running` sync_runs as failed */
async function cleanupStuckRuns(supabase: any) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await supabase
    .from('sync_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_details: { message: 'Auto-marked failed: stuck in running > 30min' },
    })
    .eq('status', 'running')
    .lt('started_at', cutoff);
}

// ============================================================================
// SCRAPING WITH ENHANCED RETRY AND TIMEOUT
// ============================================================================

async function scrapeWithConfig(
  url: string,
  extractionPrompt: string,
  apiKey: string,
  config: SourceConfig,
  logger: DiagnosticLogger
): Promise<{ success: boolean; data?: any; error?: string; attempts: number; totalTimeMs: number }> {
  const startTime = Date.now();
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const attemptStart = Date.now();
    
    try {
      logger.info('scrape', `Attempt ${attempt}/${config.maxRetries}`, { url, timeout: config.totalTimeoutMs });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.totalTimeoutMs);
      
      // Use simpler scraping with markdown + LLM extraction - faster than json schema
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
          waitFor: 3000, // Reduced from 5000-8000
          timeout: 30000, // Reduced timeout
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const attemptDuration = Date.now() - attemptStart;
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for throttling
        if (response.status === 429 || response.status === 403) {
          logger.warn('scrape', `Throttled (${response.status}), stopping retries`, { url });
          return {
            success: false,
            error: `Throttled: ${response.status}`,
            attempts: attempt,
            totalTimeMs: Date.now() - startTime,
          };
        }
        
        // Check for timeout
        if (response.status === 408 || errorText.includes('SCRAPE_TIMEOUT')) {
          lastError = `Timeout after ${attemptDuration}ms (attempt ${attempt})`;
          logger.warn('scrape', lastError, { 
            url, 
            status: response.status, 
            phase: 'scrape',
            timeoutConfig: config.totalTimeoutMs,
          });
        } else {
          lastError = `HTTP ${response.status}: ${errorText.substring(0, 100)}`;
          logger.warn('scrape', `Request failed`, { status: response.status, error: errorText.substring(0, 100) });
        }
        
        // Exponential backoff
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.initialDelayMs * Math.pow(2, attempt - 1),
            config.maxDelayMs
          );
          const jitteredDelay = addJitter(delay, config.jitterMs);
          logger.info('scrape', `Waiting ${jitteredDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        }
        continue;
      }
      
      const result = await response.json();
      logger.info('scrape', `Success on attempt ${attempt}`, { duration: attemptDuration });
      logger.setUrlExample('listado', url);
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
      
    } catch (error) {
      const attemptDuration = Date.now() - attemptStart;
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = `Client timeout after ${attemptDuration}ms`;
        logger.warn('scrape', lastError, { url, phase: 'connect' });
      } else {
        lastError = error instanceof Error ? error.message : String(error);
        logger.warn('scrape', `Exception: ${lastError}`, { url });
      }
      
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.initialDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );
        const jitteredDelay = addJitter(delay, config.jitterMs);
        logger.info('scrape', `Waiting ${jitteredDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
  }
  
  logger.setUrlExample('fichaFail', url);
  return {
    success: false,
    error: lastError,
    attempts: config.maxRetries,
    totalTimeMs: Date.now() - startTime,
  };
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
  
  if (error) return null;
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
  
  if (error) return null;
  return created.id;
}

async function upsertEventWithOccurrences(
  supabase: any,
  source: any,
  eventData: any,
  occurrences: Array<{ date: string; time?: string; end_time?: string }>,
  logger: DiagnosticLogger
): Promise<{ inserted: boolean; updated: boolean; occurrences_created: number; skipped: boolean }> {
  const title = cleanTitle(eventData.title);
  if (!title) {
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
  
  // Clean description using the same HTML entity decoding
  const cleanDescription = eventData.description ? decodeHtmlEntities(eventData.description).replace(/<[^>]*>/g, '').trim() : '';
  
  const eventPayload = {
    title,
    description: cleanDescription.substring(0, 500) || `Evento en ${venueName}`,
    description_short: cleanDescription.substring(0, 150) || null,
    description_full: cleanDescription || null,
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
    image_status: imageUrl ? 'ok' : 'missing',
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
    logger.debug('persist', `Updated: ${title}`);
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
      logger.error('persist', `Insert failed: ${title}`, { error: error.message });
      return { inserted: false, updated: false, occurrences_created: 0, skipped: true };
    }
    
    eventId = newEvent.id;
    isNew = true;
    logger.info('persist', `Inserted: ${title}`);
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
// SYNC SINGLE SOURCE (Independent Job)
// ============================================================================

interface SyncSourceResult {
  source: string;
  slug: string;
  status: 'success' | 'partial' | 'failed' | 'throttled';
  eventsFound: number;
  inserted: number;
  updated: number;
  skipped: number;
  occurrencesCreated: number;
  attempts: number;
  totalTimeMs: number;
  error?: string;
  urlExamples: { listado?: string; fichaOk?: string; fichaFail?: string };
  diagnostics: DiagnosticEntry[];
}

async function syncSingleSource(
  source: any,
  firecrawlApiKey: string,
  supabase: any,
  logger: DiagnosticLogger
): Promise<SyncSourceResult> {
  const startTime = Date.now();
  logger.setSource(source.slug);
  logger.info('init', `Starting sync for ${source.name}`);
  
  const config = getSourceConfig(source.slug);
  
  const result: SyncSourceResult = {
    source: source.name,
    slug: source.slug,
    status: 'failed',
    eventsFound: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    occurrencesCreated: 0,
    attempts: 0,
    totalTimeMs: 0,
    urlExamples: {},
    diagnostics: [],
  };
  
  // Create sync run record
  const { data: syncRun } = await supabase
    .from('sync_runs')
    .insert({ source: source.slug, status: 'running' })
    .select('id')
    .single();
  
  try {
    const urlToScrape = source.chosen_entrypoint || source.fallback_entrypoint;
    
    if (!urlToScrape) {
      throw new Error('No entrypoint URL configured');
    }
    
    logger.info('scrape', `Entrypoint: ${urlToScrape}`, { 
      config: {
        maxRetries: config.maxRetries,
        totalTimeoutMs: config.totalTimeoutMs,
        useHeadless: config.useHeadless,
      }
    });
    
    const extractionPrompt = `Extrae TODOS los eventos de esta página de programación. Para cada evento: title, description (breve), occurrences (TODAS las fechas en formato DD/MM/YYYY y hora HH:MM para los próximos 6 meses), venue, city, image_url, ticket_url, price.`;
    
    let events: any[] = [];
    let scrapeResult: { success: boolean; data?: any; error?: string; attempts: number; totalTimeMs: number } | null = null;
    let strategyUsed = 'firecrawl-llm';
    let directHttpStatus: number | undefined;
    
    // STRATEGY 1: Try direct fetcher (HTML/RSS/JSON-LD) first — much faster than Firecrawl
    const direct = await tryDirectFetcher(source.slug, source);
    if (direct) {
      directHttpStatus = direct.http_status;
      logger.info('scrape', `Direct fetcher [${direct.strategy}]: ok=${direct.ok} http=${direct.http_status} events=${direct.events.length}`, { error: direct.error });
      if (direct.ok && direct.events.length > 0) {
        events = direct.events;
        strategyUsed = direct.strategy;
        scrapeResult = { success: true, data: { events }, attempts: 1, totalTimeMs: 0 };
        logger.setUrlExample('listado', source.chosen_entrypoint || '');
      }
    }
    
    // STRATEGY 2: Firecrawl + LLM extraction (fallback)
    if (events.length === 0) {
      scrapeResult = await scrapeWithConfig(
        urlToScrape,
        extractionPrompt,
        firecrawlApiKey,
        config,
        logger
      );
      
      result.attempts = scrapeResult.attempts;
      result.totalTimeMs = scrapeResult.totalTimeMs;
      result.urlExamples = logger.getUrlExamples();
      
      if (scrapeResult.success && scrapeResult.data?.success && scrapeResult.data?.data) {
        if (scrapeResult.data.data.json?.events) {
          events = scrapeResult.data.data.json.events;
          strategyUsed = 'firecrawl-llm';
        } else if (scrapeResult.data.data.events) {
          events = scrapeResult.data.data.events;
          strategyUsed = 'firecrawl-llm';
        }
      }
    } else {
      result.attempts = 1;
      result.urlExamples = logger.getUrlExamples();
    }

    
    // If main scrape failed or no events, try WordPress API fallback for sources that have it
    if ((events.length === 0 || !scrapeResult.success) && config.alternativeEndpoint) {
      logger.info('scrape', `Trying WordPress API fallback: ${config.alternativeEndpoint}`);
      
      try {
        const wpResponse = await fetch(config.alternativeEndpoint, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (wpResponse.ok) {
          const wpData = await wpResponse.json();
          
          // Handle WordPress Tribe Events API format
          if (wpData.events && Array.isArray(wpData.events)) {
            events = wpData.events.map((e: any) => ({
              title: e.title || e.name,
              description: e.description?.replace(/<[^>]*>/g, '').substring(0, 400),
              occurrences: [{
                date: e.start_date ? new Date(e.start_date).toLocaleDateString('es-ES') : null,
                time: e.start_date ? new Date(e.start_date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null,
              }].filter(o => o.date),
              venue: e.venue?.venue || source.default_venue,
              city: e.venue?.city || source.default_location,
              image_url: e.image?.url,
              ticket_url: e.website || e.url,
              price: e.cost,
              is_free: e.cost === '' || e.cost === 'Free' || e.cost === 'Gratis',
            }));
            
            logger.info('scrape', `WordPress API returned ${events.length} events`);
            logger.setUrlExample('listado', config.alternativeEndpoint);
            scrapeResult = { success: true, data: { events }, attempts: 1, totalTimeMs: Date.now() - startTime };
          }
        } else {
          logger.warn('scrape', `WordPress API failed: ${wpResponse.status}`);
        }
      } catch (wpError) {
        logger.warn('scrape', `WordPress API error: ${wpError instanceof Error ? wpError.message : 'Unknown'}`);
      }
    }
    
    // If still no events and main scrape failed
    if (events.length === 0 && scrapeResult && !scrapeResult.success) {
      const isBestEffort = ['la-garrapata'].includes(source.slug);
      const isBlocked = scrapeResult.error?.includes('403') || scrapeResult.error?.includes('401') || scrapeResult.error?.includes('login');
      
      if (isBestEffort || isBlocked) {
        logger.warn('scrape', `Source ${source.slug} blocked or best-effort — skipping gracefully`);
        result.status = 'partial';
        result.error = isBlocked ? 'Source blocked (403/401)' : 'Best-effort source returned no events';
      } else {
        if (scrapeResult.error?.includes('Throttled')) {
          result.status = 'throttled';
        }
        result.error = scrapeResult.error;
        throw new Error(scrapeResult.error);
      }
    }
    
    events = events.filter((e: any) => e.title && isValidEventTitle(e.title));
    result.eventsFound = events.length;
    
    logger.info('parse', `Found ${events.length} valid events`);
    
    if (events.length === 0) {
      logger.warn('parse', 'No valid events found - possible JS rendering issue or empty calendar');
      result.status = 'partial';
      result.error = 'No events extracted (possible JS rendering or empty calendar)';
    } else {
      // Process events
      for (const event of events) {
        let occurrences = event.occurrences || [];
        
        if (occurrences.length === 0 && event.date) {
          occurrences = [{ date: event.date, time: event.time }];
        }
        
        if (occurrences.length === 0) {
          result.skipped++;
          logger.debug('persist', `Skipped event without dates: ${event.title?.substring(0, 50)}`);
          continue;
        }
        
        const upsertResult = await upsertEventWithOccurrences(supabase, source, event, occurrences, logger);
        
        if (upsertResult.skipped) {
          result.skipped++;
        } else if (upsertResult.inserted) {
          result.inserted++;
          logger.debug('persist', `Inserted: ${event.title?.substring(0, 50)}`);
        } else if (upsertResult.updated) {
          result.updated++;
          logger.debug('persist', `Updated: ${event.title?.substring(0, 50)}`);
        }
        
        result.occurrencesCreated += upsertResult.occurrences_created;
      }
      
      result.status = result.inserted > 0 || result.updated > 0 ? 'success' : 'partial';
    }
    
    // Update sync run with full diagnostics
    if (syncRun?.id) {
      await supabase
        .from('sync_runs')
        .update({
          status: result.status === 'success' ? 'completed' : result.status,
          finished_at: new Date().toISOString(),
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
          occurrences_created: result.occurrencesCreated,
          error_details: {
            strategy_used: strategyUsed,
            http_status: directHttpStatus,
            events_found_raw: result.eventsFound,
            events_created: result.inserted,
            events_updated: result.updated,
            events_skipped: result.skipped,
            duration_ms: Date.now() - startTime,
            attempts: result.attempts,
            urlExamples: result.urlExamples,
            message: result.error || null,
          },
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
    logger.error('complete', `Sync failed: ${errorMsg}`);
    result.error = errorMsg;
    
    if (syncRun?.id) {
      await supabase
        .from('sync_runs')
        .update({
          status: result.status === 'throttled' ? 'throttled' : 'failed',
          finished_at: new Date().toISOString(),
          errors: 1,
          error_details: {
            message: errorMsg,
            attempts: result.attempts,
            urlExamples: result.urlExamples,
            diagnostics: logger.getLogsForSource(source.slug).slice(-10),
          },
        })
        .eq('id', syncRun.id);
    }
  }
  
  result.totalTimeMs = Date.now() - startTime;
  result.diagnostics = logger.getLogsForSource(source.slug);
  
  logger.info('complete', `Finished: ${result.status}`, {
    events: result.eventsFound,
    inserted: result.inserted,
    updated: result.updated,
    duration: result.totalTimeMs,
  });
  
  return result;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  const logger = new DiagnosticLogger();
  logger.setSource('main');
  logger.info('init', '=== STARTING SYNC ===');

  try {
    // Rate limit check (prevent abuse of sync endpoint)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isSyncRateLimited(clientIP)) {
      logger.warn('init', 'Rate limited', { ip: clientIP });
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...getAllHeaders(origin), 'Retry-After': '3600' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: getAllHeaders(origin) }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Cleanup stuck `running` sync_runs from prior crashed invocations
    await cleanupStuckRuns(supabase);

    // Parse request body with validation
    let targetSlugs: string[] | null = null;
    
    try {
      const body = await req.json();
      if (body.sources && Array.isArray(body.sources)) {
        // Validate slugs (only alphanumeric + hyphens, max 10 sources)
        targetSlugs = body.sources
          .slice(0, 10)
          .filter((s: unknown) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s));
      }
    } catch {
      // No body - run all sources
    }

    // Get sources from database
    let query = supabase
      .from('sources_config')
      .select('*')
      .eq('is_active', true);
    
    if (targetSlugs && targetSlugs.length > 0) {
      query = query.in('slug', targetSlugs);
    }
    
    const { data: sources, error: sourcesError } = await query;
    
    if (sourcesError || !sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active sources found' }),
        { status: 500, headers: getAllHeaders(origin) }
      );
    }

    logger.info('init', `Found ${sources.length} sources: ${sources.map(s => s.name).join(', ')}`);

    // Validate all source URLs before scraping (SSRF prevention)
    for (const source of sources) {
      const url = source.chosen_entrypoint || `https://${source.domain}`;
      if (!isUrlAllowedForScraping(url)) {
        logger.warn('init', `Blocked source URL: ${url}`);
        continue;
      }
    }

    // Process each source independently
    const results: SyncSourceResult[] = [];
    
    for (const source of sources) {
      const result = await syncSingleSource(source, firecrawlApiKey, supabase, logger);
      results.push(result);
      
      // Rate limiting between sources
      if (sources.indexOf(source) < sources.length - 1) {
        const config = getSourceConfig(source.slug);
        const delay = addJitter(config.requestDelayMs, config.jitterMs);
        logger.info('init', `Rate limit pause: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Summary
    const summary = {
      total_sources: sources.length,
      success: results.filter(r => r.status === 'success').length,
      partial: results.filter(r => r.status === 'partial').length,
      failed: results.filter(r => r.status === 'failed').length,
      throttled: results.filter(r => r.status === 'throttled').length,
      total_events_found: results.reduce((sum, r) => sum + r.eventsFound, 0),
      total_inserted: results.reduce((sum, r) => sum + r.inserted, 0),
      total_updated: results.reduce((sum, r) => sum + r.updated, 0),
      total_occurrences: results.reduce((sum, r) => sum + r.occurrencesCreated, 0),
    };

    logger.info('complete', '=== SYNC COMPLETED ===', summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        results: results.map(r => ({
          source: r.source,
          slug: r.slug,
          status: r.status,
          eventsFound: r.eventsFound,
          inserted: r.inserted,
          updated: r.updated,
          occurrencesCreated: r.occurrencesCreated,
          attempts: r.attempts,
          durationMs: r.totalTimeMs,
          error: r.error,
          urlExamples: r.urlExamples,
        })),
      }),
      { status: 200, headers: getAllHeaders(origin) }
    );

  } catch (error) {
    logger.error('complete', 'Fatal error', { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: getAllHeaders(origin) }
    );
  }
});
