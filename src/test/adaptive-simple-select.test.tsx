import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleSelect } from '@/components/ui/adaptive/SimpleSelect';

// Force desktop path
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
];

describe('SimpleSelect', () => {
  it('opens with click and closes with Escape returning focus to trigger', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SimpleSelect
        value="a"
        onValueChange={onChange}
        options={OPTIONS}
        title="Test"
        ariaLabel="Test select"
      />,
    );
    const trigger = screen.getByRole('combobox', { name: /test select/i });
    await user.click(trigger);
    expect(screen.getByRole('listbox', { name: /test select/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // After close, trigger should have focus
    expect(document.activeElement).toBe(trigger);
  });

  it('selects an option and announces aria-selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SimpleSelect
        value="a"
        onValueChange={onChange}
        options={OPTIONS}
        title="Test"
        ariaLabel="Test select"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    await user.click(options[1]);
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('trigger meets 44px minimum target', async () => {
    render(
      <SimpleSelect
        value="a"
        onValueChange={() => {}}
        options={OPTIONS}
        title="Test"
        ariaLabel="Test select"
      />,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toMatch(/min-h-\[44px\]/);
  });
});
