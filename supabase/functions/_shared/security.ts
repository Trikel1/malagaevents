/**
 * Shared security utilities for edge functions
 * Defense-in-depth: rate limiting, input validation, SSRF prevention
 */

// ============================================================================
// CORS HEADERS (strict, no wildcards)
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://malagaevents.lovable.app',
  'https://id-preview--e27fc85d-8f7a-4dbf-a4f6-bc1aa35b0665.lovable.app',
  'https://lovable.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Default to first allowed origin if request origin not in list
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };
}

export function getAllHeaders(requestOrigin?: string | null): Record<string, string> {
  return {
    ...getCorsHeaders(requestOrigin),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// RATE LIMITING (in-memory, per-function instance)
// ============================================================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60000, // 1 minute
  blockDurationMs: 300000, // 5 minutes block after exceeding
};

export function isRateLimited(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = identifier;
  const record = rateLimitStore.get(key);

  // Check if blocked
  if (record?.blockedUntil && now < record.blockedUntil) {
    return {
      limited: true,
      remaining: 0,
      resetIn: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  // Reset if window expired
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetIn: Math.ceil(config.windowMs / 1000),
    };
  }

  // Increment and check
  record.count++;

  if (record.count > config.maxRequests) {
    // Block if exceeded
    if (config.blockDurationMs) {
      record.blockedUntil = now + config.blockDurationMs;
    }
    return {
      limited: true,
      remaining: 0,
      resetIn: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  return {
    limited: false,
    remaining: config.maxRequests - record.count,
    resetIn: Math.ceil((record.resetAt - now) / 1000),
  };
}

export function getRateLimitHeaders(result: { remaining: number; resetIn: number }): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetIn),
  };
}

// ============================================================================
// SSRF PREVENTION
// ============================================================================

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.azure.com',
];

const BLOCKED_IP_RANGES = [
  /^10\./,           // Private 10.x.x.x
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private 172.16-31.x.x
  /^192\.168\./,     // Private 192.168.x.x
  /^169\.254\./,     // Link-local
  /^fc00:/,          // IPv6 private
  /^fe80:/,          // IPv6 link-local
];

const ALLOWED_SCRAPING_DOMAINS = [
  'teatrocervantes.com',
  'teatroechegaray.es',
  'teatrodelsoho.com',
  'lacocheracabaret.com',
  'salatrinchera.com',
  'paris15.es',
  'antojo.es',
  'salamarte.com',
  'eventual.es',
  'firecrawl.dev',
  'api.firecrawl.dev',
];

export function isUrlAllowedForScraping(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block non-HTTP(S)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { allowed: false, reason: 'Only HTTP/HTTPS protocols allowed' };
    }

    // Block private/metadata hosts
    if (BLOCKED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return { allowed: false, reason: 'Blocked host' };
    }

    // Block private IP ranges
    for (const pattern of BLOCKED_IP_RANGES) {
      if (pattern.test(hostname)) {
        return { allowed: false, reason: 'Private IP range blocked' };
      }
    }

    // Check against allowlist
    const isAllowed = ALLOWED_SCRAPING_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { allowed: false, reason: `Domain not in allowlist: ${hostname}` };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }
}

// ============================================================================
// INPUT VALIDATION HELPERS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  } = {}
): { valid: boolean; error?: string; value?: string } {
  const { required = false, minLength = 0, maxLength = 10000, pattern } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, value: '' };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }

  if (pattern && !pattern.test(trimmed)) {
    return { valid: false, error: `${fieldName} has invalid format` };
  }

  return { valid: true, value: trimmed };
}

export function validateArray(
  value: unknown,
  fieldName: string,
  options: {
    maxItems?: number;
    itemValidator?: (item: unknown) => boolean;
  } = {}
): { valid: boolean; error?: string; value?: unknown[] } {
  const { maxItems = 100, itemValidator } = options;

  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }

  if (value.length > maxItems) {
    return { valid: false, error: `${fieldName} exceeds maximum of ${maxItems} items` };
  }

  if (itemValidator) {
    const allValid = value.every(itemValidator);
    if (!allValid) {
      return { valid: false, error: `${fieldName} contains invalid items` };
    }
  }

  return { valid: true, value };
}

export function validateUUID(value: unknown, fieldName: string): { valid: boolean; error?: string; value?: string } {
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }

  return { valid: true, value };
}

// ============================================================================
// TEXT SANITIZATION (for scraped content)
// ============================================================================

/**
 * Decode HTML entities to readable characters
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  // Decode HTML entities first
  let clean = decodeHtmlEntities(String(text));
  
  // Strip HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  
  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
}

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

// ============================================================================
// LOGGING (scrubbed, no PII/secrets)
// ============================================================================

export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
  const scrubbed = data ? scrubSensitiveData(data) : undefined;
  const prefix = `[${level.toUpperCase()}]`;
  
  if (scrubbed) {
    console[level](`${prefix} ${message}`, JSON.stringify(scrubbed));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

function scrubSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization', 'cookie'];
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      scrubbed[key] = scrubSensitiveData(value as Record<string, unknown>);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

export async function verifyAdminRole(
  supabase: { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }> },
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    
    if (error) {
      safeLog('error', 'Failed to verify admin role', { error });
      return false;
    }
    
    return data === true;
  } catch {
    return false;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// ============================================================================
// REQUEST AUTHORIZATION (audit 2026-09-07)
// ============================================================================

/**
 * Constant-time-ish string comparison so a wrong shared key cannot be guessed
 * byte by byte from response timing.
 */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Actor = 'cron' | 'admin';

export interface AuthorizationResult {
  authorized: boolean;
  actor?: Actor;
  reason?: string;
}

/**
 * Guard for privileged, resource-consuming endpoints (ingestion, scraping,
 * discovery). Two accepted callers:
 *
 *  1. Scheduled jobs presenting the `x-sync-key` shared secret.
 *  2. A signed-in user holding the `admin` role (the admin panel invokes these
 *     functions with the caller's JWT).
 *
 * MUST be called before any external fetch, any write and any logging of the
 * request payload.
 */
export async function authorizeAdminRequest(req: Request): Promise<AuthorizationResult> {
  const syncKey = req.headers.get('x-sync-key');
  const expected = Deno.env.get('SYNC_ADMIN_KEY');
  if (syncKey && expected && safeEquals(syncKey, expected)) {
    return { authorized: true, actor: 'cron' };
  }

  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) return { authorized: false, reason: 'Missing credentials' };

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return { authorized: false, reason: 'Server not configured' };

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return { authorized: false, reason: 'Invalid session' };
    }
    const isAdmin = await verifyAdminRole(
      client as unknown as { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }> },
      userData.user.id,
    );
    if (!isAdmin) return { authorized: false, reason: 'Admin role required' };
    return { authorized: true, actor: 'admin' };
  } catch {
    return { authorized: false, reason: 'Authorization check failed' };
  }
}

/** Standard 401 body for unauthorized privileged calls. */
export function unauthorizedResponse(
  result: AuthorizationResult,
  headers: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Unauthorized', reason: result.reason ?? 'Unauthorized' }),
    { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } },
  );
}
