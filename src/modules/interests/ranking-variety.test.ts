import { describe, expect, it } from 'vitest';
import { pickStarterSelection, rankItems, type RankableItem } from './ranking';

const NOW = new Date('2026-09-08T10:00:00Z');

const item = (id: string, category: string, kind: 'culture' | 'sports', dayOffset: number): RankableItem => ({
  id,
  kind,
  title: id,
  category,
  tags: null,
  startAt: new Date(NOW.getTime() + dayOffset * 86_400_000).toISOString(),
});

describe('recommendation variety', () => {
  it('does not let one taste monopolize the shortlist', () => {
    // Eight basketball games and two electronic sessions: without
    // diversification the whole home screen would be basketball.
    const items: RankableItem[] = [
      ...Array.from({ length: 8 }, (_, i) => item(`b${i}`, 'baloncesto', 'sports', i + 1)),
      item('e1', 'music', 'culture', 3),
      item('e2', 'music', 'culture', 4),
    ];
    items[8].title = 'Sesión techno con DJ invitado';
    items[9].title = 'Noche electronica en sala';

    const plain = rankItems(items, ['basketball', 'electronic_music'], { now: NOW, limit: 6 });
    const varied = rankItems(items, ['basketball', 'electronic_music'], {
      now: NOW,
      limit: 6,
      diversify: true,
    });

    expect(plain.every((r) => r.reasonInterestId === 'basketball')).toBe(true);

    const reasons = new Set(varied.map((r) => r.reasonInterestId));
    expect(reasons.has('basketball')).toBe(true);
    expect(reasons.has('electronic_music')).toBe(true);
    // Same items, only re-ordered: nothing invented, nothing dropped.
    expect(varied).toHaveLength(6);
    expect(new Set(varied.map((r) => r.item.id)).size).toBe(6);
  });

  it('keeps the strongest match first', () => {
    const items = [item('a', 'baloncesto', 'sports', 1), item('b', 'cine', 'culture', 2)];
    const varied = rankItems(items, ['basketball', 'cinema'], { now: NOW, limit: 2, diversify: true });
    expect(varied[0].item.id).toBe('a');
  });

  it('offers a varied starter selection with no saved tastes', () => {
    const items: RankableItem[] = [
      ...Array.from({ length: 5 }, (_, i) => item(`t${i}`, 'theater', 'culture', i + 1)),
      item('m1', 'music', 'culture', 6),
      item('s1', 'futbol', 'sports', 7),
    ];
    const starter = pickStarterSelection(items, { now: NOW, limit: 4 });
    const categories = new Set(starter.map((i) => i.category));
    expect(starter).toHaveLength(4);
    expect(categories.size).toBeGreaterThan(1);
  });

  it('never proposes a plan that already happened', () => {
    const items = [item('past', 'theater', 'culture', -3), item('future', 'theater', 'culture', 2)];
    const starter = pickStarterSelection(items, { now: NOW, limit: 5 });
    expect(starter.map((i) => i.id)).toEqual(['future']);
  });
});
