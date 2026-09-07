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
import gastronomia from '@/assets/categories/gastronomia.jpg';
import empleo from '@/assets/categories/empleo.jpg';
import cine from '@/assets/categories/cine.jpg';
import literatura from '@/assets/categories/literatura.jpg';

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
 * Extra illustrative themes that do not exist as event categories but do occur
 * often in the municipal agenda (food-handling courses, employment training,
 * film screenings, book events).
 */
const EXTRA_THEME_IMAGES = {
  gastronomia,
  empleo,
  cine,
  literatura,
} as const;

type ExtraTheme = keyof typeof EXTRA_THEME_IMAGES;

/**
 * Title-based hints, used ONLY to pick an illustration when the stored category
 * is `other`. It never changes the event's real category nor any filter.
 */
const TITLE_HINTS: Array<{ type: EventType | ExtraTheme; terms: string[] }> = [
  { type: 'gastronomia', terms: ['manipulacion de alimentos', 'alimentos', 'alergenos', 'cocina', 'gastronom', 'cata de', 'reposteria', 'higiene alimentaria', 'hosteleria'] },
  { type: 'empleo', terms: ['nominas', 'seguros sociales', 'competencias', 'empleo', 'emprend', 'laboral', 'contabilidad', 'fiscal', 'orientacion profesional', 'curriculum', 'autonomo'] },
  { type: 'cine', terms: ['cine', 'pelicula', 'cortometraje', 'documental', 'proyeccion', 'filmoteca'] },
  { type: 'literatura', terms: ['libro', 'poesia', 'poetico', 'lectura', 'club de lectura', 'novela', 'literatura', 'firma de ejemplares', 'cuentacuentos adulto'] },
  { type: 'workshops', terms: ['curso', 'taller', 'formacion', 'masterclass', 'seminario', 'webinar', '3d', 'modelado', 'vr', 'ar', 'realidad virtual', 'programacion', 'tecnologia', 'digital', 'itinerario formativo'] },
  { type: 'exhibitions', terms: ['exposicion', 'muestra', 'visita guiada', 'museo', 'galeria', 'pintura', 'fotografia', 'escultura', 'artes plasticas'] },
  { type: 'music', terms: ['concierto', 'recital', 'orquesta', 'jazz', 'rock', 'flamenco', 'dj set', 'coro', 'banda de musica'] },
  { type: 'theater', terms: ['teatro', 'obra de teatro', 'circo', 'opera', 'zarzuela', 'musical'] },
  { type: 'dance', terms: ['danza', 'ballet', 'baile'] },
  { type: 'comedy', terms: ['monologo', 'comedia', 'humor', 'stand up'] },
  { type: 'kids', terms: ['infantil', 'ninos', 'familiar', 'cuentacuentos', 'titeres', 'ludoteca'] },
  { type: 'conferences', terms: ['conferencia', 'charla', 'ponencia', 'coloquio', 'mesa redonda', 'presentacion de libro', 'jornada', 'congreso'] },
  { type: 'festival', terms: ['festival', 'feria', 'verbena', 'romeria'] },
];

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isExtraTheme = (value: EventType | ExtraTheme): value is ExtraTheme =>
  value in EXTRA_THEME_IMAGES;

/** Resolves an illustrative theme from a title. Returns undefined if unclear. */
export function eventTypeFromTitle(title?: string | null): EventType | undefined {
  const theme = themeFromTitle(title);
  if (!theme || isExtraTheme(theme)) return undefined;
  return theme;
}

function themeFromTitle(title?: string | null): EventType | ExtraTheme | undefined {
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
    const theme = themeFromTitle(title);
    if (theme && isExtraTheme(theme)) return EXTRA_THEME_IMAGES[theme];
    if (theme) return CATEGORY_IMAGES[theme];
    return GENERAL_EVENT_IMAGE;
  }
  return CATEGORY_IMAGES[type] ?? GENERAL_EVENT_IMAGE;
}

