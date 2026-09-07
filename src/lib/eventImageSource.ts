/**
 * Poster URL hygiene.
 *
 * A poster is only shown when it plausibly belongs to the event:
 * - insecure http URLs are upgraded to https (an http image is blocked on the
 *   published https site and renders as a broken box),
 * - known generic/corporate default images (a source's own "no picture" logo)
 *   are rejected so they never masquerade as the event's official poster.
 */

/** Path fragments that identify a source's generic fallback image. */
const GENERIC_FRAGMENTS = [
  'corporativas/default/',
  'agenda-l.png',
  'placeholder',
  'no-image',
  'noimage',
  'sin-imagen',
  'default-image',
  'imagen-por-defecto',
  'blank.',
  'spacer.',
];

export function sanitizeEventImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  // Inline data / relative assets are left untouched only when they are ours.
  if (value.startsWith('data:image/')) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.protocol === 'http:') url.protocol = 'https:';

  const haystack = `${url.pathname}${url.search}`.toLowerCase();
  if (GENERIC_FRAGMENTS.some((fragment) => haystack.includes(fragment))) return null;

  return url.toString();
}
