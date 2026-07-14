import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import i18n from '@/i18n';

// Mock sports hooks to control loading / empty / populated states without Supabase.
const useSportsEventsMock = vi.fn();
const useSportsVenuesMock = vi.fn();
vi.mock('@/hooks/useSportsEvents', () => ({
  useSportsEvents: (...args: unknown[]) => useSportsEventsMock(...args),
  useSportsVenues: (...args: unknown[]) => useSportsVenuesMock(...args),
}));

import SportsEventsPage from '@/components/sports/SportsEventsPage';

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/sports']}>
          <Routes>
            <Route path="/sports" element={ui} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

describe('Sprint UI 4 · /sports', () => {
  beforeEach: {
  }

  it('renderiza el hero deportivo dedicado con título propio, subtítulo y buscador', () => {
    useSportsEventsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useSportsVenuesMock.mockReturnValue({ data: [], isLoading: false });

    wrap(<SportsEventsPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Deporte en Málaga/i })).toBeInTheDocument();
    expect(screen.getByText(/Competiciones, actividades/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Buscar deporte, equipo, competición o recinto/i),
    ).toBeInTheDocument();
  });

  it('muestra los filtros temporales Hoy · Este finde · Próximos', () => {
    useSportsEventsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useSportsVenuesMock.mockReturnValue({ data: [], isLoading: false });

    wrap(<SportsEventsPage />);

    expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Este finde/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Próximos/i).length).toBeGreaterThan(0);
  });

  it('estado vacío ofrece acciones y NO expone instrucciones de administración', () => {
    useSportsEventsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useSportsVenuesMock.mockReturnValue({ data: [], isLoading: false });

    const { container } = wrap(<SportsEventsPage />);

    // "Ver próximos eventos" siempre disponible en el estado vacío principal
    expect(screen.getByRole('button', { name: /Ver próximos eventos/i })).toBeInTheDocument();

    const text = container.textContent || '';
    expect(text).not.toMatch(/Sync Deportes/i);
    expect(text).not.toMatch(/\bAdmin\b/);
  });

  it('no filtra claves i18n crudas del namespace sports.* en la UI', () => {
    useSportsEventsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useSportsVenuesMock.mockReturnValue({
      data: [
        { id: 'v1', name: 'Estadio X', city: 'Málaga', address: null, lat: null, lng: null, sports: ['futbol', 'running'] },
      ],
      isLoading: false,
    });

    const { container } = wrap(<SportsEventsPage />);
    const text = container.textContent || '';

    // No debe aparecer nunca una clave del i18n como texto plano
    expect(text).not.toMatch(/sports\.futbol/);
    expect(text).not.toMatch(/sports\.football/);
    expect(text).not.toMatch(/sports\.[a-z_]+\b(?!\s)/);
  });

  it('actualiza el buscador del hero al teclear', async () => {
    useSportsEventsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useSportsVenuesMock.mockReturnValue({ data: [], isLoading: false });

    wrap(<SportsEventsPage />);
    const input = screen.getByPlaceholderText(/Buscar deporte, equipo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'unicaja' } });
    await waitFor(() => expect(input.value).toBe('unicaja'));
  });
});
