/**
 * Route/component regression tests for the culture Agenda URL synchronization.
 * These render the real EventsPage inside a real router and assert on both the
 * resulting URL and the options handed to the data layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { EventFilters } from '@/components/events/FilterDrawer';

let lastOptions: any = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: any) =>
      typeof def === 'string' ? def : def?.defaultValue ?? key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('@/hooks/useEventsOptimized', () => ({
  useEventsOptimized: (options: any) => {
    lastOptions = options;
    return {
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
      totalCount: 0,
    };
  },
}));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({ data: [] }),
  useFavoriteEvents: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useToggleFavorite: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useLocations', () => ({ useLocations: () => ({ data: [] }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => ({ isAuthenticated: false }) }));
vi.mock('@/contexts/AppModeContext', () => ({ useAppMode: () => ({ appMode: 'cultura' }) }));
vi.mock('@/components/sports/SportsEventsPage', () => ({ default: () => null }));
vi.mock('@/components/common/SEO', () => ({ default: () => null }));
vi.mock('@/components/events/VenueKindFilter', () => ({ VenueKindFilter: () => null }));
vi.mock('@/components/events/LocationFilter', () => ({ default: () => null }));
vi.mock('@/components/events/UpcomingHighlights', () => ({ default: () => null }));
vi.mock('@/components/events/GroupedEventsList', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

// Drawer stub: exposes an "apply" and a "remove" action driving real props.
vi.mock('@/components/events/FilterDrawer', () => ({
  default: ({ filters, onApplyFilters }: { filters: EventFilters; onApplyFilters: (f: EventFilters) => void }) => (
    <div>
      <button onClick={() => onApplyFilters({ ...filters, categories: ['theater'], isFree: true })}>
        drawer-apply
      </button>
      <button onClick={() => onApplyFilters({ ...filters, isFree: undefined })}>drawer-remove-free</button>
    </div>
  ),
}));

import EventsPage from '@/pages/EventsPage';

const LocationProbe = () => {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="search">{loc.search}</output>
      <button onClick={() => navigate(-1)}>go-back</button>
      <button onClick={() => navigate(1)}>go-forward</button>
    </>
  );
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <EventsPage />
      <LocationProbe />
    </MemoryRouter>,
  );

const url = () => screen.getByTestId('search').textContent ?? '';

beforeEach(() => {
  lastOptions = null;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('EventsPage URL synchronization', () => {
  it('applies a legacy /events?filter=weekend link on first render', () => {
    renderAt('/events?filter=weekend');
    expect(lastOptions.filters.datePreset).toBe('weekend');
  });

  it('keeps family + free + weekend on a shared/reloaded link', () => {
    renderAt('/events?filter=family,free&preset=weekend');
    expect(lastOptions.filters).toMatchObject({
      familyKids: true,
      isFree: true,
      datePreset: 'weekend',
    });
  });

  it('a preset change does not drop the family/free scope and preserves unrelated params', () => {
    renderAt('/events?filter=family,free&preset=weekend&utm_source=news');
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    const out = new URLSearchParams(url());
    expect(out.get('preset')).toBe('today');
    expect(out.get('family')).toBe('1');
    expect(out.get('free')).toBe('1');
    expect(out.get('utm_source')).toBe('news');
    expect(out.get('filter')).toBeNull();
    expect(lastOptions.filters.datePreset).toBe('today');
  });

  it('search commits to the URL after the debounce and survives back/forward', () => {
    renderAt('/events');
    const input = screen.getByLabelText('Buscar') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'jazz' } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(new URLSearchParams(url()).get('q')).toBe('jazz');
    expect(lastOptions.searchQuery).toBe('jazz');

    fireEvent.click(screen.getByText('go-back'));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(new URLSearchParams(url()).get('q')).toBeNull();
    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('');
    expect(lastOptions.searchQuery).toBeUndefined();

    fireEvent.click(screen.getByText('go-forward'));
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(new URLSearchParams(url()).get('q')).toBe('jazz');
    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('jazz');
  });

  it('Enter commits the search immediately without waiting for the debounce', () => {
    renderAt('/events');
    const input = screen.getByLabelText('Buscar') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'teatro' } });
    fireEvent.submit(input.closest('form')!);
    expect(new URLSearchParams(url()).get('q')).toBe('teatro');
  });

  it('removing the category chip clears only the category param', () => {
    renderAt('/events?category=music&utm_source=news');
    expect(lastOptions.filters.categories).toEqual(['music']);
    const chip = screen.getByRole('button', { name: /Quitar/ });
    fireEvent.click(chip);
    const out = new URLSearchParams(url());
    expect(out.get('category')).toBeNull();
    expect(out.get('utm_source')).toBe('news');
    expect(lastOptions.filters.categories).toEqual([]);
  });

  it('drawer apply and remove are serialized to the URL', () => {
    renderAt('/events');
    fireEvent.click(screen.getByText('drawer-apply'));
    let out = new URLSearchParams(url());
    expect(out.get('category')).toBe('theater');
    expect(out.get('free')).toBe('1');

    fireEvent.click(screen.getByText('drawer-remove-free'));
    out = new URLSearchParams(url());
    expect(out.get('free')).toBeNull();
    expect(out.get('category')).toBe('theater');
  });

  it('reset clears owned params and preserves unrelated ones', () => {
    renderAt('/events?preset=today&free=1&utm_source=news');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(url().replace(/^\?/, '')).toBe('utm_source=news');
  });
});
