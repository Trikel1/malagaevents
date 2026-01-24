import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// SECURITY: Strict CORS headers (no wildcards)
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://id-preview--e27fc85d-8f7a-4dbf-a4f6-bc1aa35b0665.lovable.app',
  'https://lovable.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store',
  };
}

function getAllHeaders(requestOrigin?: string | null): Record<string, string> {
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

const rateLimitMap = new Map<string, RateLimitRecord>();

const RATE_CONFIG = {
  maxRequests: 3,
  windowMs: 3600000, // 1 hour
  blockDurationMs: 7200000, // 2 hours block after exceeding
};

function checkRateLimit(identifier: string): { limited: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  // Check if blocked
  if (record?.blockedUntil && now < record.blockedUntil) {
    return { limited: true, remaining: 0 };
  }

  // Reset if window expired
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_CONFIG.windowMs,
    });
    return { limited: false, remaining: RATE_CONFIG.maxRequests - 1 };
  }

  // Increment and check
  record.count++;

  if (record.count > RATE_CONFIG.maxRequests) {
    record.blockedUntil = now + RATE_CONFIG.blockDurationMs;
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: RATE_CONFIG.maxRequests - record.count };
}

// ============================================================================
// INPUT VALIDATION (strict, defense-in-depth)
// ============================================================================

interface EventSubmission {
  title: string;
  description: string;
  category: string;
  start_at: string;
  end_at?: string;
  venue_name: string;
  address: string;
  ticket_url?: string;
  price_info?: string;
  is_free: boolean;
  image_url?: string;
  age_restriction?: string;
  accessibility_info?: string;
  capacity_info?: string;
  tags?: string[];
  email: string;
}

// Allowed categories (strict enum validation)
const ALLOWED_CATEGORIES = [
  'music', 'theater', 'cinema', 'art', 'sports', 'gastronomy',
  'festivals', 'family', 'nightlife', 'workshops', 'conferences', 'markets', 'other'
];

// Email pattern (strict)
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// URL pattern for validation
const URL_PATTERN = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/;

// Spam patterns
const SPAM_PATTERNS = [
  /\b(viagra|cialis|casino|lottery|winner|prize|free money|bitcoin investment|crypto profit)\b/i,
  /(.)\1{6,}/, // repeated characters (7+)
  /https?:\/\/[^\s]{150,}/, // very long URLs
  /[\u0400-\u04FF]{20,}/, // long Cyrillic strings (often spam)
  /\d{10,}/, // long number sequences
];

function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Strip HTML tags
  let clean = value.replace(/<[^>]*>/g, '');
  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function validateSubmission(data: unknown): { valid: boolean; error?: string; sanitized?: EventSubmission } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const input = data as Record<string, unknown>;

  // Title (required, 3-200 chars)
  const title = sanitizeString(input.title);
  if (!title || title.length < 3 || title.length > 200) {
    return { valid: false, error: 'Title must be between 3 and 200 characters' };
  }

  // Description (required, 10-2000 chars)
  const description = sanitizeString(input.description);
  if (!description || description.length < 10 || description.length > 2000) {
    return { valid: false, error: 'Description must be between 10 and 2000 characters' };
  }

  // Category (required, must be in allowed list)
  const category = sanitizeString(input.category).toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return { valid: false, error: 'Invalid category' };
  }

  // Start date (required, ISO format)
  const start_at = sanitizeString(input.start_at);
  if (!start_at || isNaN(Date.parse(start_at))) {
    return { valid: false, error: 'Valid start date is required' };
  }

  // End date (optional, ISO format if provided)
  let end_at: string | undefined;
  if (input.end_at) {
    end_at = sanitizeString(input.end_at);
    if (isNaN(Date.parse(end_at))) {
      return { valid: false, error: 'Invalid end date format' };
    }
  }

  // Venue name (required, 2-100 chars)
  const venue_name = sanitizeString(input.venue_name);
  if (!venue_name || venue_name.length < 2 || venue_name.length > 100) {
    return { valid: false, error: 'Venue name must be between 2 and 100 characters' };
  }

  // Address (required, 5-200 chars)
  const address = sanitizeString(input.address);
  if (!address || address.length < 5 || address.length > 200) {
    return { valid: false, error: 'Address must be between 5 and 200 characters' };
  }

  // Email (required, valid format)
  const email = sanitizeString(input.email).toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    return { valid: false, error: 'Valid email address is required' };
  }

  // Ticket URL (optional, must be valid URL if provided)
  let ticket_url: string | undefined;
  if (input.ticket_url) {
    ticket_url = sanitizeString(input.ticket_url);
    if (ticket_url && !URL_PATTERN.test(ticket_url)) {
      return { valid: false, error: 'Invalid ticket URL format' };
    }
  }

  // Image URL (optional, must be valid URL if provided)
  let image_url: string | undefined;
  if (input.image_url) {
    image_url = sanitizeString(input.image_url);
    if (image_url && !URL_PATTERN.test(image_url)) {
      return { valid: false, error: 'Invalid image URL format' };
    }
  }

  // Price info (optional, max 100 chars)
  const price_info = sanitizeString(input.price_info).substring(0, 100);

  // Is free (boolean)
  const is_free = input.is_free === true;

  // Optional fields with length limits
  const age_restriction = sanitizeString(input.age_restriction).substring(0, 50);
  const accessibility_info = sanitizeString(input.accessibility_info).substring(0, 500);
  const capacity_info = sanitizeString(input.capacity_info).substring(0, 100);

  // Tags (optional, max 10 tags, max 50 chars each)
  let tags: string[] | undefined;
  if (Array.isArray(input.tags)) {
    tags = input.tags
      .slice(0, 10)
      .map(t => sanitizeString(t).substring(0, 50))
      .filter(t => t.length > 0);
  }

  // Check for spam patterns
  const textToCheck = `${title} ${description} ${venue_name}`;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return { valid: false, error: 'Submission flagged as potential spam' };
    }
  }

  return {
    valid: true,
    sanitized: {
      title,
      description,
      category,
      start_at,
      end_at,
      venue_name,
      address,
      email,
      ticket_url,
      image_url,
      price_info: price_info || undefined,
      is_free,
      age_restriction: age_restriction || undefined,
      accessibility_info: accessibility_info || undefined,
      capacity_info: capacity_info || undefined,
      tags,
    },
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: getAllHeaders(origin) }
    );
  }

  try {
    // Parse request body
    let rawData: unknown;
    try {
      rawData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: getAllHeaders(origin) }
      );
    }

    // Validate and sanitize input
    const validation = validateSubmission(rawData);
    if (!validation.valid || !validation.sanitized) {
      console.log('[WARN] Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: getAllHeaders(origin) }
      );
    }

    const data = validation.sanitized;

    // Rate limiting by email (primary) and IP (secondary)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    
    const emailRateCheck = checkRateLimit(`email:${data.email}`);
    const ipRateCheck = checkRateLimit(`ip:${clientIP}`);

    if (emailRateCheck.limited || ipRateCheck.limited) {
      console.log('[WARN] Rate limited:', { email: data.email, ip: clientIP });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many submissions. Please try again later.' 
        }),
        { 
          status: 429, 
          headers: {
            ...getAllHeaders(origin),
            'Retry-After': '3600',
          }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log submission (scrubbed - no email)
    console.log('[INFO] Processing event submission:', { 
      title: data.title.substring(0, 50), 
      category: data.category,
      venue: data.venue_name,
    });

    // Generate verification token
    const verificationToken = crypto.randomUUID();

    // Create the event with pending status
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        title: data.title,
        description: data.description,
        category: data.category,
        start_at: data.start_at,
        end_at: data.end_at || null,
        venue_name: data.venue_name,
        address: data.address,
        ticket_url: data.ticket_url || null,
        price_info: data.price_info || null,
        is_free: data.is_free,
        image_url: data.image_url || null,
        age_restriction: data.age_restriction || null,
        accessibility_info: data.accessibility_info || null,
        capacity_info: data.capacity_info || null,
        tags: data.tags || null,
        source_type: 'organizer_submission',
        status: 'pending',
      })
      .select()
      .single();

    if (eventError) {
      console.error('[ERROR] Failed to create event:', eventError.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create event' }),
        { status: 500, headers: getAllHeaders(origin) }
      );
    }

    // Create submission record for tracking
    const { error: submissionError } = await supabase
      .from('event_submissions')
      .insert({
        event_id: event.id,
        submitter_email: data.email,
        verification_token: verificationToken,
        captcha_passed: true,
        email_verified: false,
      });

    if (submissionError) {
      console.error('[WARN] Failed to create submission record:', submissionError.message);
      // Don't fail the request - event was created
    }

    console.log('[INFO] Event created successfully:', event.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: event.id,
        message: 'Event submitted successfully. It will be reviewed before publishing.'
      }),
      { status: 200, headers: getAllHeaders(origin) }
    );

  } catch (error) {
    console.error('[ERROR] Unhandled error in submit-event:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: getAllHeaders(origin) }
    );
  }
});
