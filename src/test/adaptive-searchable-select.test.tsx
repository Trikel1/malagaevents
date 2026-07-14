import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect } from '@/components/ui/adaptive/SearchableSelect';
import '@/i18n';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const OPTS = [
  { value: 'mal', label: 'Málaga', group: 'Capital' },
  { value: 'mij', label: 'Mijas', group: 'Costa' },
  { value: 'ron', label: 'Ronda', group: 'Serranía' },
];

describe('SearchableSelect', () => {
  it('filters options by query and selects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value={null}
        onValueChange={onChange}
        options={OPTS}
        title="Localities"
        ariaLabel="Localities"
        triggerLabel="Pick"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const search = await screen.findByRole('searchbox');
    await user.type(search, 'ron');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Ronda');
    await user.click(options[0]);
    expect(onChange).toHaveBeenCalledWith('ron');
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        value={null}
        onValueChange={() => {}}
        options={OPTS}
        title="Localities"
        ariaLabel="Localities"
        triggerLabel="Pick"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const search = await screen.findByRole('searchbox');
    await user.type(search, 'zzz');
    expect(await screen.findByText(/sin resultados|no results/i)).toBeInTheDocument();
  });
});
