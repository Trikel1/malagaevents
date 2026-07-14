import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import BottomNav from '@/components/layout/BottomNav';
import TopNav from '@/components/layout/TopNav';
import { AppModeProvider } from '@/contexts/AppModeContext';

const renderAt = (path: string, ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AppModeProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AppModeProvider>
    </I18nextProvider>,
  );

describe('Navegación estable', () => {
  it('BottomNav muestra los 5 destinos fijos independientemente de la ruta', () => {
    const paths = ['/', '/events', '/sports', '/venues', '/calendar', '/map', '/profile'];
    for (const p of paths) {
      const { unmount } = renderAt(p, <BottomNav />);
      const nav = screen.getByRole('navigation');
      const items = within(nav).getAllByRole('button');
      // 5 destinos, ninguno con etiqueta "Recintos"
      expect(items.length).toBe(5);
      const labels = items.map((b) => b.getAttribute('aria-label'));
      expect(labels).toEqual(
        expect.arrayContaining(['Inicio', 'Eventos', 'Calendario', 'Mapa', 'Perfil']),
      );
      expect(labels).not.toContain('Recintos');
      unmount();
    }
  });

  it('en /sports y /venues el destino Eventos queda marcado como actual', () => {
    for (const p of ['/sports', '/venues']) {
      const { unmount } = renderAt(p, <BottomNav />);
      const eventsBtn = screen.getByRole('button', { name: 'Eventos' });
      expect(eventsBtn.getAttribute('aria-current')).toBe('page');
      unmount();
    }
  });

  it('TopNav expone Eventos y Deportes como destinos separados con aria-current', () => {
    renderAt('/sports', <TopNav />);
    const sportsLink = screen.getByRole('link', { name: /Deportes/i });
    expect(sportsLink.getAttribute('aria-current')).toBe('page');
    const eventsLink = screen.getByRole('link', { name: 'Eventos' });
    expect(eventsLink.getAttribute('aria-current')).toBeNull();
  });
});
