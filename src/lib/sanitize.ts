/**
 * Sanitization utilities for security (XSS prevention)
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize text content - removes HTML tags and escapes entities
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // First strip HTML tags
  const withoutTags = String(text).replace(/<[^>]*>/g, '');
  // Then escape any remaining entities
  return escapeHtml(withoutTags);
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
 * Sanitize description for display - allows limited formatting
 */
export function sanitizeDescription(text: string | null | undefined, maxLength?: number): string {
  if (!text) return '';
  
  // Strip all HTML tags
  let clean = String(text).replace(/<[^>]*>/g, '');
  
  // Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Truncate if needed
  if (maxLength && clean.length > maxLength) {
    clean = clean.substring(0, maxLength - 3) + '...';
  }
  
  return escapeHtml(clean);
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
