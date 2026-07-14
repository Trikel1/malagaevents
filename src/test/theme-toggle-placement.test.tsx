import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from 'next-themes';
import i18n from '@/i18n';

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ isAuthenticated: false, user: null, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import TopNav from '@/components/layout/TopNav';
import BottomNav from '@/components/layout/BottomNav';

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider attribute="class" defaultTheme="light">
            <MemoryRouter>{ui}</MemoryRouter>
          </ThemeProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe('Theme toggle placement', () => {
  it('TopNav renders the theme toggle trigger', () => {
    wrap(<TopNav />);
    // The ThemeToggle exposes a role=combobox with an aria-label for theme.
    const triggers = screen.getAllByRole('combobox');
    const themeTrigger = triggers.find((el) =>
      /tema|theme|apariencia|appearance/i.test(el.getAttribute('aria-label') ?? '')
    );
    expect(themeTrigger).toBeTruthy();
  });

  it('BottomNav does NOT contain the theme toggle', () => {
    wrap(<BottomNav />);
    const combos = screen.queryAllByRole('combobox');
    const themeInBottom = combos.find((el) =>
      /tema|theme|apariencia|appearance/i.test(el.getAttribute('aria-label') ?? '')
    );
    expect(themeInBottom).toBeFalsy();
  });

  it('TopNav shows Málaga Events wordmark', () => {
    wrap(<TopNav />);
    expect(screen.getByText(/Málaga Events/)).toBeTruthy();
  });
});
