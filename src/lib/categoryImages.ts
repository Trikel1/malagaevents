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

import type { EventType } from '@/components/events/EventImage';

/** Only categories with an approved image appear here. */
export const CATEGORY_IMAGES: Partial<Record<EventType, string>> = {
  music: musica,
  festival: musica,
  nightlife: musica,
  theater: teatro,
  dance: teatro,
  comedy: teatro,
};

export function categoryImageFor(type: EventType): string | undefined {
  return CATEGORY_IMAGES[type];
}
