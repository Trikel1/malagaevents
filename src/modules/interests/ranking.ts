/**
 * Deterministic, explainable ranking for "Para ti".
 *
 * No behavioural inference, no popularity, no remote scoring: only the
 * interests the user picked, matched against normalized category / tags /
 * title signals, plus a small freshness bonus. Ties break chronologically and
 * then by id, so the same input always produces the same output.
 */

import { INTEREST_CATALOG, type InterestDefinition } from './catalog';

export type RankableKind = 'culture' | 'sports';

export interface RankableItem {
  id: string;
  kind: RankableKind;
  title: string;
  /** Legacy category / sport value straight from the database. */
  category?: string | null;
  tags?: string[] | null;
  /** ISO date-time used for the freshness bonus and the chronological tiebreak. */
  startAt: string;
}

export interface RankedItem<T extends RankableItem = RankableItem> {
  item: T;
  score: number;
  /** Interest id that explains the recommendation, if any. */
  reasonInterestId: string | null;
}

export const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word (or whole-phrase) match, so "moto" never matches "motor". */
export const hasWordSignal = (haystack: string, needle: string): boolean => {
  const n = normalize(needle);
  if (!n) return false;
  return new RegExp(`(^|\\s)${escapeRe(n)}(\\s|$)`).test(haystack);
};

const WEIGHT_CATEGORY = 4;
const WEIGHT_TAG = 3;
const WEIGHT_TITLE = 2;
const MAX_FRESHNESS = 1.5;
const FRESHNESS_WINDOW_DAYS = 30;

const matchInterest = (
  interest: InterestDefinition,
  normCategory: string,
  normTags: string[],
  normTitle: string,
): number => {
  let score = 0;

  if (normCategory) {
    const legacyHit = interest.legacyValues.some((v) => normalize(v) === normCategory);
    const keywordHit = interest.keywords.some((k) => hasWordSignal(normCategory, k));
    if (legacyHit || keywordHit) score += WEIGHT_CATEGORY;
  }

  if (normTags.length > 0) {
    const tagHit = normTags.some(
      (tag) =>
        interest.legacyValues.some((v) => normalize(v) === tag) ||
        interest.keywords.some((k) => hasWordSignal(tag, k)),
    );
    if (tagHit) score += WEIGHT_TAG;
  }

  if (normTitle && interest.keywords.some((k) => hasWordSignal(normTitle, k))) {
    score += WEIGHT_TITLE;
  }

  return score;
};

export const scoreItem = (
  item: RankableItem,
  interestIds: string[],
): { score: number; reasonInterestId: string | null } => {
  if (interestIds.length === 0) return { score: 0, reasonInterestId: null };

  const normCategory = normalize(item.category ?? '');
  const normTags = (item.tags ?? []).map((t) => normalize(String(t))).filter(Boolean);
  const normTitle = normalize(item.title ?? '');

  let best = 0;
  let bestId: string | null = null;
  let total = 0;

  for (const interest of INTEREST_CATALOG) {
    if (!interestIds.includes(interest.id)) continue;
    const s = matchInterest(interest, normCategory, normTags, normTitle);
    if (s <= 0) continue;
    total += s;
    if (s > best) {
      best = s;
      bestId = interest.id;
    }
  }

  return { score: total, reasonInterestId: bestId };
};

export const freshnessBonus = (startAt: string, now: Date): number => {
  const start = new Date(startAt).getTime();
  if (Number.isNaN(start)) return 0;
  const days = (start - now.getTime()) / 86_400_000;
  if (days < 0) return 0;
  if (days >= FRESHNESS_WINDOW_DAYS) return 0;
  return Number((MAX_FRESHNESS * (1 - days / FRESHNESS_WINDOW_DAYS)).toFixed(4));
};

export interface RankOptions {
  now?: Date;
  limit?: number;
  /**
   * Round-robin the shortlist across the interests that explain each item, so a
   * single taste (or a single category) cannot monopolize the home screen when
   * the user combined several. Pure re-ordering: nothing is added or dropped.
   */
  diversify?: boolean;
}

/** Interleaves the ranked list by `reasonInterestId`, best group first. */
export const diversifyByReason = <T extends RankableItem>(
  ranked: RankedItem<T>[],
): RankedItem<T>[] => {
  const groups = new Map<string, RankedItem<T>[]>();
  for (const r of ranked) {
    const key = r.reasonInterestId ?? '_';
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  // Map preserves insertion order, which already follows the ranking, so the
  // strongest match still leads the list.
  const queues = Array.from(groups.values());
  const out: RankedItem<T>[] = [];
  let round = 0;
  while (out.length < ranked.length) {
    let moved = false;
    for (const q of queues) {
      if (round < q.length) {
        out.push(q[round]);
        moved = true;
      }
    }
    if (!moved) break;
    round += 1;
  }
  return out;
};

/**
 * Ranks every eligible candidate and only then applies the display limit, so
 * the shortlist is a real top-N over the whole candidate set.
 */
export const rankItems = <T extends RankableItem>(
  items: T[],
  interestIds: string[],
  options: RankOptions = {},
): RankedItem<T>[] => {
  const now = options.now ?? new Date();

  const scored = items
    .map((item) => {
      const { score, reasonInterestId } = scoreItem(item, interestIds);
      return { item, score: score > 0 ? score + freshnessBonus(item.startAt, now) : 0, reasonInterestId };
    })
    .filter((r) => r.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ta = new Date(a.item.startAt).getTime();
    const tb = new Date(b.item.startAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.item.id.localeCompare(b.item.id);
  });

  const ordered = options.diversify ? diversifyByReason(scored) : scored;

  return typeof options.limit === 'number' ? ordered.slice(0, options.limit) : ordered;
};

/**
 * Starter selection for visitors with no saved tastes: the soonest upcoming
 * items, one per category before repeating any, so the first screen is useful
 * and varied without pretending to know the person.
 */
export const pickStarterSelection = <T extends RankableItem>(
  items: T[],
  options: { now?: Date; limit?: number } = {},
): T[] => {
  const now = options.now ?? new Date();
  const upcoming = items
    .filter((i) => {
      const t = new Date(i.startAt).getTime();
      return !Number.isNaN(t) && t >= now.getTime();
    })
    .sort((a, b) => {
      const d = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

  const groups = new Map<string, T[]>();
  for (const item of upcoming) {
    const key = `${item.kind}:${normalize(item.category ?? '') || 'otros'}`;
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  const queues = Array.from(groups.values());
  const out: T[] = [];
  let round = 0;
  while (out.length < upcoming.length) {
    let moved = false;
    for (const q of queues) {
      if (round < q.length) {
        out.push(q[round]);
        moved = true;
      }
    }
    if (!moved) break;
    round += 1;
  }

  return typeof options.limit === 'number' ? out.slice(0, options.limit) : out;
};

