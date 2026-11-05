import { describe, it, expect, beforeEach } from 'vitest';
import { rememberAgendaSearch, agendaReturnPath, rememberAgendaScroll, takeAgendaScroll } from './agendaReturn';

describe('agenda return context', () => {
  beforeEach(() => sessionStorage.clear());

  it('returns to plain /events when nothing was saved', () => {
    expect(agendaReturnPath()).toBe('/events');
  });

  it('keeps the filters when going back to the agenda', () => {
    rememberAgendaSearch('preset=weekend&q=flamenco');
    expect(agendaReturnPath()).toBe('/events?preset=weekend&q=flamenco');
  });

  it('restores scroll only for the same search, once', () => {
    rememberAgendaScroll('preset=weekend', 820);
    expect(takeAgendaScroll('preset=today')).toBeNull();
    rememberAgendaScroll('preset=weekend', 820);
    expect(takeAgendaScroll('preset=weekend')).toBe(820);
    expect(takeAgendaScroll('preset=weekend')).toBeNull();
  });
});
