import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeInterestIds, INTEREST_IDS, interestsByDomain } from './catalog';
import { readInterests, writeInterests, guestStorageKey, userStorageKey } from './storage';
import { rankItems, hasWordSignal, type RankableItem } from './ranking';
import { isSignedUrl, getOptimizedUrl } from '@/components/events/EventImage';

const soon = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

describe('interest catalog', () => {
  it('keeps only known ids, deduplicated and in catalog order', () => {
    expect(sanitizeInterestIds(['basketball', 'nope', 'concerts', 'concerts'])).toEqual(
      INTEREST_IDS.filter((id) => id === 'concerts' || id === 'basketball'),
    );
  });

  it('tolerates non-array input', () => {
    expect(sanitizeInterestIds(undefined)).toEqual([]);
    expect(sanitizeInterestIds('concerts' as unknown as string[])).toEqual([]);
    expect(sanitizeInterestIds([1, null] as unknown as string[])).toEqual([]);
  });

  it('offers both domains and never forces an interest', () => {
    expect(interestsByDomain('culture').length).toBeGreaterThan(5);
    expect(interestsByDomain('sports').length).toBeGreaterThan(5);
    expect(sanitizeInterestIds([])).toEqual([]);
  });

  it('lists nightlife, electronic music and motorcycling as distinct interests', () => {
    for (const id of ['nightlife', 'electronic_music', 'motorcycling', 'motorsport', 'family_kids']) {
      expect(INTEREST_IDS).toContain(id);
    }
  });
});

describe('interest storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a selection', () => {
    expect(writeInterests(guestStorageKey(), ['nightlife'])).toBe(true);
    expect(readInterests(guestStorageKey())).toEqual(['nightlife']);
  });

  it('isolates guest and per-user keys', () => {
    writeInterests(guestStorageKey(), ['nightlife']);
    writeInterests(userStorageKey('user-a'), ['football']);
    expect(readInterests(userStorageKey('user-b'))).toEqual([]);
    expect(readInterests(userStorageKey('user-a'))).toEqual(['football']);
  });

  it('discards corrupt or foreign-version payloads', () => {
    localStorage.setItem(guestStorageKey(), '{ not json');
    expect(readInterests(guestStorageKey())).toEqual([]);
    localStorage.setItem(guestStorageKey(), JSON.stringify({ version: 99, interestIds: ['nightlife'] }));
    expect(readInterests(guestStorageKey())).toEqual([]);
  });
});

describe('ranking', () => {
  it('does not treat "motor" as a motorcycling signal', () => {
    expect(hasWordSignal('gran premio de motociclismo', 'motociclismo')).toBe(true);
    expect(hasWordSignal('salon del motor', 'moto')).toBe(false);
  });

  it('ranks mixed culture and sport interests together', () => {
    const items: RankableItem[] = [
      { id: 'a', kind: 'culture', title: 'Sesión de música electrónica', category: 'music', tags: ['electronica'], startAt: soon(2) },
      { id: 'b', kind: 'sports', title: 'Partido de baloncesto', category: 'baloncesto', tags: [], startAt: soon(3) },
      { id: 'c', kind: 'culture', title: 'Recital de poesía', category: 'literatura', tags: [], startAt: soon(1) },
    ];
    const ranked = rankItems(items, ['electronic_music', 'basketball'], { limit: 10 });
    // Both domains survive; the poetry recital (no matching interest) does not.
    expect(ranked.map((r) => r.item.id).sort()).toEqual(['a', 'b']);
    expect(ranked.find((r) => r.item.id === 'a')?.reasonInterestId).toBe('electronic_music');
    expect(ranked.find((r) => r.item.id === 'b')?.reasonInterestId).toBe('basketball');
  });

  it('returns nothing rather than filler when no item matches', () => {
    const items: RankableItem[] = [
      { id: 'c', kind: 'culture', title: 'Recital de poesía', category: 'literatura', tags: [], startAt: soon(1) },
    ];
    expect(rankItems(items, ['motorcycling'], { limit: 10 })).toEqual([]);
  });

  it('breaks ties chronologically', () => {
    const items: RankableItem[] = [
      { id: 'late', kind: 'culture', title: 'Concierto', category: 'conciertos', tags: [], startAt: soon(20) },
      { id: 'early', kind: 'culture', title: 'Concierto', category: 'conciertos', tags: [], startAt: soon(19) },
    ];
    expect(rankItems(items, ['concerts'], { limit: 10 })[0].item.id).toBe('early');
  });
});

describe('image URL handling', () => {
  it('never rewrites a signed URL into fake variants', () => {
    const signed = 'https://x.supabase.co/storage/v1/object/sign/tickets/a.jpg?token=abc';
    expect(isSignedUrl(signed)).toBe(true);
    expect(getOptimizedUrl(signed, 400)).toBeNull();
  });

  it('still optimises plain provider URLs', () => {
    expect(getOptimizedUrl('https://images.unsplash.com/photo-1', 400)).toContain('w=400');
  });
});
