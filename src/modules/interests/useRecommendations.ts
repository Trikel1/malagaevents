import { useMemo } from 'react';
import { useEvents } from '@/hooks/useEvents';
import { useSportsAgenda } from '@/hooks/useSportsAgenda';
import type { Event } from '@/types';
import type { SportsEntity } from '@/types/sportsEntities';
import { pickStarterSelection, rankItems, type RankableItem, type RankedItem } from './ranking';

export type Recommendation =
  | { kind: 'culture'; id: string; reasonInterestId: string | null; event: Event }
  | { kind: 'sports'; id: string; reasonInterestId: string | null; entity: SportsEntity };

const CANDIDATE_LIMIT = 80;

const toCultureRankable = (e: Event): RankableItem => ({
  id: e.id,
  kind: 'culture',
  title: e.title,
  category: e.category,
  tags: e.tags ?? null,
  startAt: e.start_at,
});

const toSportsRankable = (e: SportsEntity): RankableItem => ({
  id: e.id,
  kind: 'sports',
  title: [e.name, e.discipline].filter(Boolean).join(' '),
  category: e.sport,
  tags: e.tags ?? null,
  startAt: `${e.date_start}T${(e.time_start ?? '00:00:00').slice(0, 8)}`,
});

/**
 * Combines the two public datasets at the UI layer only — no row is copied
 * between tables — and ranks the whole candidate set before slicing.
 *
 * With no saved tastes it still returns something useful: a varied starter
 * selection of the soonest plans, flagged as `isStarter` so the UI can say so
 * instead of implying it knows the visitor.
 */
export function useRecommendations(interestIds: string[], limit = 6) {
  const personalized = interestIds.length > 0;

  const culture = useEvents({ limit: CANDIDATE_LIMIT });
  const sports = useSportsAgenda({ window: '30d' });

  const { recommendations, hasCandidates } = useMemo(() => {
    const cultureEvents = culture.data ?? [];
    const sportsEntities = (sports.data ?? []).filter((e) => Boolean(e.date_start));

    const byId = new Map<string, Event | SportsEntity>();
    const rankable: RankableItem[] = [];

    for (const e of cultureEvents) {
      byId.set(`c:${e.id}`, e);
      rankable.push({ ...toCultureRankable(e), id: `c:${e.id}` });
    }
    for (const e of sportsEntities) {
      byId.set(`s:${e.id}`, e);
      rankable.push({ ...toSportsRankable(e), id: `s:${e.id}` });
    }

    const ranked: RankedItem[] = personalized
      ? rankItems(rankable, interestIds, { limit, diversify: true })
      : pickStarterSelection(rankable, { limit }).map((item) => ({
          item,
          score: 0,
          reasonInterestId: null,
        }));

    const recommendations = ranked.map<Recommendation>((r) => {
      const raw = byId.get(r.item.id)!;
      return r.item.kind === 'culture'
        ? { kind: 'culture', id: r.item.id, reasonInterestId: r.reasonInterestId, event: raw as Event }
        : { kind: 'sports', id: r.item.id, reasonInterestId: r.reasonInterestId, entity: raw as SportsEntity };
    });

    return {
      recommendations,
      hasCandidates: cultureEvents.length + sportsEntities.length > 0,
    };
  }, [personalized, culture.data, sports.data, interestIds, limit]);

  return {
    recommendations,
    hasCandidates,
    isStarter: !personalized,
    isLoading: culture.isLoading || sports.isLoading,
    isError: culture.isError || sports.isError,
  };
}
