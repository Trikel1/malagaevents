/**
 * Category labels shown in the UI.
 *
 * The stored `category` column is not clean: besides the ten canonical keys it
 * still holds values coming straight from the sources ("venue", "Cursos y
 * talleres"). Those have no translation, so the raw key used to leak into the
 * interface as "categories.venue". This maps anything unknown onto a real
 * label instead of inventing a new category.
 */
export const CANONICAL_CATEGORIES = [
  'conferences',
  'exhibitions',
  'festivals',
  'kids',
  'music',
  'nightlife',
  'other',
  'sports',
  'theater',
  'workshops',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const ALIASES: Record<string, CanonicalCategory> = {
  venue: 'other',
  venues: 'other',
  'cursos y talleres': 'workshops',
  cursos: 'workshops',
  talleres: 'workshops',
  taller: 'workshops',
  teatro: 'theater',
  musica: 'music',
  música: 'music',
  infantil: 'kids',
  exposiciones: 'exhibitions',
  deportes: 'sports',
  otros: 'other',
};

/** Returns the i18n key suffix to use under `categories.` */
export function categoryI18nKey(category: string | null | undefined): CanonicalCategory {
  if (!category) return 'other';
  const raw = category.trim();
  const lower = raw.toLowerCase();
  if ((CANONICAL_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as CanonicalCategory;
  }
  return ALIASES[lower] ?? 'other';
}
