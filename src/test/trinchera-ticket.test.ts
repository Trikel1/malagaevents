import { describe, expect, it } from 'vitest';
import { matchEventFromTicket } from '../../supabase/functions/_shared/ingestion/trinchera-ticket';

const event = (extra: Record<string, unknown> = {}) => ({
  '@type': 'MusicEvent', name: 'The Silencers', startDate: '2026-10-15T20:00:00+0200',
  eventStatus: 'https://schema.org/EventScheduled',
  location: { name: 'Sala La Trinchera', address: { addressLocality: 'Málaga' } }, ...extra,
});

describe('Trinchera official ticket date matching', () => {
  it.each([
    ['15/10 The Silencers', '2026-10-15T20:00:00+0200'],
    ['16/10 Plastic Woods', '2026-10-16T21:00:00+02:00'],
    ['03/12 Salma', '2026-12-03T20:00:00+01:00'],
  ])('keeps the exact published instant for %s', (title, startDate) => {
    const input = event({ startDate });
    expect(matchEventFromTicket(title, [input])).toEqual(input);
  });
  it('compares the Madrid day when UTC is still the previous day', () => {
    const input = event({ startDate: '2026-10-14T22:30:00Z' });
    expect(matchEventFromTicket('15/10 Night event', [input])).toEqual(input);
  });
  it.each(['15/10', '2026-10-15', '2026-10-15T20:00:00', '2026-02-30T20:00:00+01:00'])('rejects incomplete or impossible event date %s', startDate => {
    expect(matchEventFromTicket('15/10 The Silencers', [event({ startDate })])).toBeUndefined();
  });
  it('rejects a different source day or month', () => {
    expect(matchEventFromTicket('16/10 The Silencers', [event()])).toBeUndefined();
    expect(matchEventFromTicket('15/11 The Silencers', [event()])).toBeUndefined();
  });
  it('rejects another venue, city, cancelled event and malformed metadata', () => {
    for (const input of [null, {}, event({ location: { name: 'Other room' } }), event({ location: { name: 'Trinchera', address: { addressLocality: 'Madrid' } } }), event({ eventStatus: 'https://schema.org/EventCancelled' })]) {
      expect(matchEventFromTicket('15/10 The Silencers', [input])).toBeUndefined();
    }
  });
  it('accepts absent city while keeping the explicitly named venue', () => {
    const input = event({ location: { name: 'La Trinchera' } });
    expect(matchEventFromTicket('15/10 The Silencers', [input])).toEqual(input);
  });
  it('rejects distinct matching sessions instead of choosing one', () => {
    expect(matchEventFromTicket('15/10 The Silencers', [event(), event({ startDate: '2026-10-15T22:00:00+02:00' })])).toBeUndefined();
  });
  it('rejects postponed events and metadata that is not an Event', () => {
    expect(matchEventFromTicket('15/10 The Silencers', [event({ eventStatus: 'https://schema.org/EventPostponed' })])).toBeUndefined();
    expect(matchEventFromTicket('15/10 The Silencers', [event({ '@type': 'Article' })])).toBeUndefined();
  });
});
