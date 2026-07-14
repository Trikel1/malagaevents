import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import i18n from '@/i18n';

// Build a large synthetic directory (only inside the test; the app itself does NOT fabricate rows).
const bigDirectory = Array.from({ length: 120 }, (_, i) => ({
  id: `dir-${i}`,
  name: `Farmacia ${i + 1}`,
  address: `C/ Ejemplo ${i + 1}`,
  municipality: 'Málaga',
  phone: '952000000',
  lat: null,
  lng: null,
}));

vi.mock('@/hooks/usePharmacies', () => ({
  usePharmaciesOnDuty: () => ({ data: [], isLoading: false }),
  usePharmacyDirectory: () => ({ data: bigDirectory, isLoading: false }),
}));

import PharmaciesPage from '@/pages/PharmaciesPage';

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/pharmacies']}>{ui}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

describe('Sprint UI 7 · Farmacias — carga progresiva', () => {
  it('renderiza inicialmente 24 farmacias del directorio, no las 120', () => {
    wrap(<PharmaciesPage />);
    const list = screen.getByTestId('pharmacy-dir-list');
    const cards = within(list).getAllByRole('heading', { level: 3 });
    expect(cards).toHaveLength(24);
  });

  it('el contador indica "Mostrando 24 de 120"', () => {
    wrap(<PharmaciesPage />);
    const count = screen.getByTestId('pharmacy-dir-count');
    expect(count.textContent).toMatch(/24.*120/);
  });

  it('"Mostrar más" añade 24 farmacias adicionales y desaparece al llegar al total', async () => {
    const user = userEvent.setup();
    wrap(<PharmaciesPage />);
    let list = screen.getByTestId('pharmacy-dir-list');
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(24);

    // First page-more → 48
    await user.click(screen.getByTestId('pharmacy-show-more'));
    list = screen.getByTestId('pharmacy-dir-list');
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(48);

    // Keep clicking until it disappears
    for (let i = 0; i < 5; i++) {
      const btn = screen.queryByTestId('pharmacy-show-more');
      if (!btn) break;
      await user.click(btn);
    }

    expect(screen.queryByTestId('pharmacy-show-more')).toBeNull();
    list = screen.getByTestId('pharmacy-dir-list');
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(120);
  });

  it('el botón "Mostrar más" cumple 44 px mínimos y expone aria-label descriptivo', () => {
    wrap(<PharmaciesPage />);
    const btn = screen.getByTestId('pharmacy-show-more');
    expect(btn.className).toMatch(/min-h-11/);
    expect(btn.getAttribute('aria-label') || '').toMatch(/pendientes|remaining/i);
  });

  it('los CTA de llamar y cómo llegar tienen aria-label accesible y tap-area ≥44px', () => {
    wrap(<PharmaciesPage />);
    const callLinks = screen.getAllByRole('link', { name: /Llamar Farmacia 1/i });
    expect(callLinks.length).toBeGreaterThan(0);
    // The Button asChild renders an <a>; the parent <button-styled> class carries min-h-11.
    expect(callLinks[0].className).toMatch(/min-h-11/);

    const mapsLinks = screen.getAllByRole('link', { name: /Cómo llegar.*Farmacia 1/i });
    expect(mapsLinks.length).toBeGreaterThan(0);
  });

  it('no muestra badge oficial en tarjetas del directorio (solo en guardias)', () => {
    wrap(<PharmaciesPage />);
    const list = screen.getByTestId('pharmacy-dir-list');
    expect(within(list).queryByText(/De guardia hoy/i)).toBeNull();
  });
});
