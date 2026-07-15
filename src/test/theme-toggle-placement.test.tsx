import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
import { ThemeToggle } from '@/components/common/ThemeToggle';

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

  it('ThemeToggle opens a Popover (listbox), never a bottom Sheet', () => {
    // Force a mobile-sized viewport to make sure the toggle still renders a popover.
    (window as any).innerWidth = 390;
    (window as any).innerHeight = 844;
    window.dispatchEvent(new Event('resize'));

    wrap(<ThemeToggle variant="nav" />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    // Radix Popover exposes the content with the role we set (listbox).
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
    // Must NOT be a Radix Dialog (which is what our Sheet is built on).
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.closest('[role="dialog"]')).toBeNull();

    // The three theme options render as option rows with min-h 44px.
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3);
  });
});
