import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import i18n from '@/i18n';

// ---------- Shared hook mocks ----------
vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCalendarOccurrences: () => ({ data: {}, occurrences: [], isLoading: false }),
}));
vi.mock('@/hooks/useSportsEvents', () => ({
  useSportsEvents: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useVenues', () => ({
  useVenues: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/usePharmacies', () => ({
  usePharmaciesOnDuty: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({ data: [] }),
  useToggleFavorite: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ isAuthenticated: false, user: null }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/contexts/AppModeContext', () => ({
  useAppMode: () => ({ appMode: 'eventos', setAppMode: vi.fn() }),
}));
// Leaflet not needed under jsdom — stub the map
vi.mock('@/modules/maps/LeafletMap', () => ({
  LeafletMap: () => <div data-testid="leaflet-stub" />,
}));

import CalendarPage from '@/pages/CalendarPage';
import MapPage from '@/pages/MapPage';

const wrap = (ui: React.ReactNode, path = '/') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

describe('Sprint UI 6 · Calendario', () => {
  it('los controles de navegación de mes son botones de al menos 44px', () => {
    wrap(<CalendarPage />, '/calendar');
    const prev = screen.getByRole('button', { name: /Mes anterior/i });
    const next = screen.getByRole('button', { name: /Mes siguiente/i });
    expect(prev.className).toMatch(/h-11/);
    expect(next.className).toMatch(/h-11/);
  });

  it('abre el selector de mes/año como overlay accesible', async () => {
    const user = userEvent.setup();
    wrap(<CalendarPage />, '/calendar');
    const trigger = screen.getByRole('button', { name: /Seleccionar mes y año/i });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    await user.click(trigger);
    // Popover renders a listbox of months
    const list = await screen.findByRole('listbox', { name: /Meses/i });
    expect(list).toBeInTheDocument();
  });

  it('selecciona un día del grid y expone aria-pressed', async () => {
    const user = userEvent.setup();
    wrap(<CalendarPage />, '/calendar');
    const grid = screen.getByRole('grid');
    // Find any cell for day 15 in the current view
    const day = grid.querySelectorAll('button')[10];
    await user.click(day!);
    expect(day!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Sprint UI 6 · Mapa', () => {
  it('renderiza filtros como chips accesibles con hit-area 44px', () => {
    wrap(<MapPage />, '/map');
    const filters = screen.getByRole('toolbar', { name: /Filtros/i });
    const chips = filters.querySelectorAll('button');
    expect(chips.length).toBeGreaterThan(1);
    chips.forEach((c) => expect(c.className).toMatch(/min-h-\[44px\]/));
  });

  it('cambia el filtro activo al hacer clic (aria-pressed)', async () => {
    const user = userEvent.setup();
    wrap(<MapPage />, '/map');
    const filters = screen.getByRole('toolbar', { name: /Filtros/i });
    const venuesBtn = Array.from(filters.querySelectorAll('button')).find(
      (b) => /Recintos|Venues/i.test(b.textContent || ''),
    )!;
    await user.click(venuesBtn);
    expect(venuesBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('el conmutador Mapa/Lista alterna la vista', async () => {
    const user = userEvent.setup();
    wrap(<MapPage />, '/map');
    const listTab = screen.getByRole('tab', { name: /Lista|List/i });
    await user.click(listTab);
    expect(listTab.getAttribute('aria-pressed')).toBe('true');
  });

  it('la búsqueda actualiza el input y muestra botón de limpiar', async () => {
    const user = userEvent.setup();
    wrap(<MapPage />, '/map');
    const input = screen.getByPlaceholderText(/Buscar eventos/i) as HTMLInputElement;
    await user.type(input, 'teatro');
    expect(input.value).toBe('teatro');
    expect(screen.getByRole('button', { name: /Limpiar búsqueda/i })).toBeInTheDocument();
  });

  it('los chips de filtros usan scroll horizontal con máscara (sin overflow visible que corte)', () => {
    wrap(<MapPage />, '/map');
    const toolbar = screen.getByRole('toolbar', { name: /Filtros/i });
    expect(toolbar.className).toMatch(/overflow-x-auto/);
  });
});
