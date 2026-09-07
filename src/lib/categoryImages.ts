/**
 * Editorial illustrative images per category.
 *
 * These are project assets, generated once and shipped with the app. They are
 * never fetched per visit and never stand in for an official poster: they only
 * fill the gap when an event has no verified image of its own, and the UI keeps
 * labelling them as illustrative.
 */
import musica from '@/assets/categories/musica.jpg';
import teatro from '@/assets/categories/teatro.jpg';
import formacion from '@/assets/categories/formacion.jpg';
import exposiciones from '@/assets/categories/exposiciones.jpg';
import infantil from '@/assets/categories/infantil.jpg';
import nightlifeImg from '@/assets/categories/nightlife.jpg';
import festivalImg from '@/assets/categories/festival.jpg';
import conferencia from '@/assets/categories/conferencia.jpg';
import danza from '@/assets/categories/danza.jpg';
import comedia from '@/assets/categories/comedia.jpg';
import general from '@/assets/categories/general.jpg';

import type { EventType } from '@/components/events/EventImage';

/** Generic agenda image, used when the theme is unknown or ambiguous. */
export const GENERAL_EVENT_IMAGE = general;

export const CATEGORY_IMAGES: Record<EventType, string> = {
  music: musica,
  festival: festivalImg,
  nightlife: nightlifeImg,
  theater: teatro,
  dance: danza,
  comedy: comedia,
  exhibitions: exposiciones,
  kids: infantil,
  workshops: formacion,
  conferences: conferencia,
  sports: general,
  other: general,
};

/**
 * Title-based hints, used ONLY to pick an illustration when the stored category
 * is `other`. It never changes the event's real category nor any filter.
 */
const TITLE_HINTS: Array<{ type: EventType; terms: string[] }> = [
  { type: 'workshops', terms: ['curso', 'taller', 'formacion', 'formación', 'masterclass', 'seminario', 'webinar', '3d', 'modelado', 'vr', 'ar', 'realidad virtual', 'programacion', 'programación', 'tecnologia', 'tecnología', 'digital'] },
  { type: 'exhibitions', terms: ['exposicion', 'exposición', 'muestra', 'visita guiada', 'museo', 'galeria', 'galería', 'pintura', 'fotografia', 'fotografía'] },
  { type: 'music', terms: ['concierto', 'recital', 'orquesta', 'jazz', 'rock', 'flamenco en vivo', 'dj set'] },
  { type: 'theater', terms: ['teatro', 'obra de teatro', 'circo', 'opera', 'ópera', 'zarzuela'] },
  { type: 'dance', terms: ['danza', 'ballet', 'baile'] },
  { type: 'comedy', terms: ['monologo', 'monólogo', 'comedia', 'humor', 'stand up'] },
  { type: 'kids', terms: ['infantil', 'niños', 'ninos', 'familiar', 'cuentacuentos', 'titeres', 'títeres'] },
  { type: 'conferences', terms: ['conferencia', 'charla', 'ponencia', 'coloquio', 'mesa redonda', 'presentacion de libro', 'presentación de libro'] },
  { type: 'festival', terms: ['festival', 'feria', 'verbena', 'romeria', 'romería'] },
];

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Resolves an illustrative theme from a title. Returns undefined if unclear. */
export function eventTypeFromTitle(title?: string | null): EventType | undefined {
  if (!title) return undefined;
  const text = normalize(title);
  for (const hint of TITLE_HINTS) {
    if (hint.terms.some((term) => text.includes(normalize(term)))) return hint.type;
  }
  return undefined;
}

/**
 * Always returns an image: the theme's editorial photo, a title-derived one for
 * uncategorised events, or the general agenda image.
 */
export function categoryImageFor(type: EventType, title?: string | null): string {
  if (type === 'other') {
    const guessed = eventTypeFromTitle(title);
    if (guessed) return CATEGORY_IMAGES[guessed];
    return GENERAL_EVENT_IMAGE;
  }
  return CATEGORY_IMAGES[type] ?? GENERAL_EVENT_IMAGE;
}
