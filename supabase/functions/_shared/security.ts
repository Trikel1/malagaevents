/**
 * Shared security utilities for edge functions
 * Defense-in-depth: rate limiting, input validation, SSRF prevention
 */

// ============================================================================
// CORS HEADERS (strict, no wildcards)
// ============================================================================

const ALLOWED_ORIGINS = [
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
