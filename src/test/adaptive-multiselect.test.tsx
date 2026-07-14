import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelect } from '@/components/ui/adaptive/MultiSelect';
import '@/i18n';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const OPTS = [
  { value: 'x', label: 'X option' },
  { value: 'y', label: 'Y option' },
  { value: 'z', label: 'Z option' },
];

describe('MultiSelect (draft selection)', () => {
  it('accumulates draft and only commits on Apply', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        values={[]}
        onValuesChange={onChange}
        options={OPTS}
        title="Multi"
        ariaLabel="Multi"
        triggerLabel="Filter"
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /multi/i }));
    const options = await screen.findAllByRole('option');
    await user.click(options[0]);
    await user.click(options[2]);
    expect(onChange).not.toHaveBeenCalled();
    const apply = screen.getByRole('button', { name: /aplicar|apply/i });
    await user.click(apply);
    expect(onChange).toHaveBeenCalledWith(['x', 'z']);
  });

  it('Clear resets draft without committing until Apply', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        values={['x', 'y']}
        onValuesChange={onChange}
        options={OPTS}
        title="Multi"
        ariaLabel="Multi"
        triggerLabel="Filter"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: /limpiar|clear/i }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /aplicar|apply/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Escape discards draft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        values={[]}
        onValuesChange={onChange}
        options={OPTS}
        title="Multi"
        ariaLabel="Multi"
        triggerLabel="Filter"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    await user.click(options[0]);
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
