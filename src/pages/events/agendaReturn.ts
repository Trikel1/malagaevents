// Remembers the last agenda search (filters in the URL) and scroll position
// so the event detail page can return the user to the same context.
const KEY_SEARCH = 'mc.agenda.lastSearch';
const KEY_SCROLL = 'mc.agenda.scroll';

const store = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function rememberAgendaSearch(search: string): void {
  store()?.setItem(KEY_SEARCH, search);
}

/** Path back to the agenda, including the last committed filters. */
export function agendaReturnPath(): string {
  const s = store()?.getItem(KEY_SEARCH) ?? '';
  return s ? `/events?${s.replace(/^\?/, '')}` : '/events';
}

export function rememberAgendaScroll(search: string, y: number): void {
  store()?.setItem(KEY_SCROLL, JSON.stringify({ search, y: Math.max(0, Math.round(y)) }));
}

/** Returns the saved scroll only if it belongs to the same search, then forgets it. */
export function takeAgendaScroll(search: string): number | null {
  const s = store();
  const raw = s?.getItem(KEY_SCROLL);
  if (!raw) return null;
  s?.removeItem(KEY_SCROLL);
  try {
    const v = JSON.parse(raw) as { search?: string; y?: number };
    return v.search === search && typeof v.y === 'number' ? v.y : null;
  } catch {
    return null;
  }
}
