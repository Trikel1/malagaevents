/**
 * Regression: LocationFilter trigger showed "Málaga" while the underlying
 * state was "Toda la provincia" (no locations selected). The trigger must
 * reflect the actual filter — "Toda la provincia" when nothing is selected.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LocationFilter from '@/components/events/LocationFilter';
import i18n from '@/i18n';

beforeAll(async () => {
  await i18n.changeLanguage('es');
});


vi.mock('@/hooks/useLocations', () => ({
  useLocations: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe('LocationFilter trigger label', () => {
  it('shows "Toda la provincia" when nothing is selected', () => {
    render(
      wrap(
        <LocationFilter
          selectedLocationIds={[]}
          onSelectionChange={() => {}}
        />,
      ),
    );
    expect(screen.getByText(/toda la provincia/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Málaga$/)).not.toBeInTheDocument();
  });
});
