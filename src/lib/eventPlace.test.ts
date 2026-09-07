import { describe, it, expect } from 'vitest';
import { isOnlineEvent } from './eventPlace';
import { categoryImageFor, eventTypeFromTitle, GENERAL_EVENT_IMAGE } from './categoryImages';

describe('isOnlineEvent', () => {
  it('detects the plain online course', () => {
    expect(isOnlineEvent({ venue_name: 'Online', address: 'Online, Málaga' })).toBe(true);
  });

  it('accepts an online venue with only the city as address', () => {
    expect(isOnlineEvent({ venue_name: 'Online', address: 'Málaga' })).toBe(true);
  });

  it('keeps physical events physical', () => {
    expect(isOnlineEvent({ venue_name: 'Teatro Cervantes', address: 'Calle Ramos Marín, 2' })).toBe(false);
  });

  it('does not treat hybrid events as online-only', () => {
    expect(isOnlineEvent({ venue_name: 'Presencial y online', address: 'Calle Larios, 1' })).toBe(false);
  });

  it('ignores an online venue when the address is a real street', () => {
    expect(isOnlineEvent({ venue_name: 'Online', address: 'Calle Alcazabilla, 2, Málaga' })).toBe(false);
  });

  it('handles missing fields', () => {
    expect(isOnlineEvent({})).toBe(false);
  });
});

describe('categoryImageFor', () => {
  it('always returns an image', () => {
    expect(categoryImageFor('other')).toBe(GENERAL_EVENT_IMAGE);
    expect(categoryImageFor('music')).toBeTruthy();
  });

  it('derives the theme from the title for uncategorised events', () => {
    expect(eventTypeFromTitle('3D: Modelado 3D y Generación de Entornos para VR/AR')).toBe('workshops');
    expect(eventTypeFromTitle('Exposición de fotografía')).toBe('exhibitions');
  });

  it('falls back to the general image when the title is unclear', () => {
    expect(categoryImageFor('other', 'Actividad municipal')).toBe(GENERAL_EVENT_IMAGE);
  });

  it('never lets the title override an explicit category', () => {
    expect(categoryImageFor('music', 'Taller de guitarra')).toBe(categoryImageFor('music'));
  });
});
