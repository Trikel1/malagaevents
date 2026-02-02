/**
 * Sanitization utilities for security (XSS prevention)
 * Note: React automatically escapes content in JSX, so we focus on:
 * - Decoding HTML entities from scraped content
 * - Removing HTML tags
 * - NOT double-escaping (React handles XSS prevention)
 */

/**
 * Decode HTML entities to readable characters
 * This is safe because React will escape any dangerous characters when rendering
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  return text
    // Named entities (most common first for performance)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Numeric entities (decimal) - e.g., &#39; -> '
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Numeric entities (hex) - e.g., &#x27; -> '
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Sanitize text content - decodes HTML entities and removes tags
 * Safe for React rendering (React handles XSS automatically)
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  let clean = String(text);
  
  // 1. Decode HTML entities first (so &lt;script&gt; becomes <script>)
  clean = decodeHtmlEntities(clean);
  
  // 2. Strip HTML tags (removes the <script> we just decoded)
  clean = clean.replace(/<[^>]*>/g, '');
  
  // 3. Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
  // Note: NO escaping here - React handles XSS prevention automatically
}

/**
 * Sanitize URL - validates and returns safe URL or empty string
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Sanitize description for display - decodes entities and limits length
 */
export function sanitizeDescription(text: string | null | undefined, maxLength?: number): string {
  if (!text) return '';
  
  // Use sanitizeText for consistent processing
  let clean = sanitizeText(text);
  
  // Truncate if needed
  if (maxLength && clean.length > maxLength) {
    clean = clean.substring(0, maxLength - 3) + '...';
  }
  
  return clean;
}

/**
 * Generate safe alt text for images
 */
export function generateAltText(title: string | null | undefined, venue?: string | null): string {
  const parts: string[] = [];
  
  if (title) {
    parts.push(sanitizeText(title));
  }
  
  if (venue) {
    parts.push(`en ${sanitizeText(venue)}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : 'Imagen del evento';
}

/**
 * Validate and sanitize event data for display
 */
export function sanitizeEventForDisplay(event: {
  title?: string | null;
  description?: string | null;
  venue_name?: string | null;
  address?: string | null;
  price_info?: string | null;
}) {
  return {
    title: sanitizeText(event.title) || 'Sin título',
    description: sanitizeDescription(event.description),
    venue_name: sanitizeText(event.venue_name) || 'Sala por confirmar',
    address: sanitizeText(event.address) || 'Dirección por confirmar',
    price_info: sanitizeText(event.price_info),
  };
}
