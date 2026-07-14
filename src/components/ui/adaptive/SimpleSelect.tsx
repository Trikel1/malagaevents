import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdaptivePopover } from './AdaptivePopover';
import { cn } from '@/lib/utils';

export interface SimpleSelectOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  /** Short indicator (e.g. language shortcode) shown left of label */
  leading?: React.ReactNode;
  /** Small trailing hint */
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface SimpleSelectProps<V extends string = string> {
  value: V;
  onValueChange: (value: V) => void;
  options: SimpleSelectOption<V>[];
  title: string;
  description?: string;
  ariaLabel: string;
  /** Custom trigger — if omitted, renders default outline button */
  trigger?: (props: { open: boolean; label: React.ReactNode }) => React.ReactNode;
  placeholder?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * SimpleSelect — adaptive listbox for short flat option lists (language, theme, sort).
 * Bottom sheet on mobile, popover on desktop. All rows ≥ 44 px.
 */
export function SimpleSelect<V extends string = string>({
  value,
  onValueChange,
  options,
  title,
  description,
  ariaLabel,
  trigger,
  placeholder,
  align = 'start',
  className,
}: SimpleSelectProps<V>) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentId = React.useId();

  const selected = options.find((o) => o.value === value);
  const label: React.ReactNode = selected?.label ?? placeholder ?? '';

  const defaultTrigger = (
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={ariaLabel}
      className={cn('justify-between gap-2 min-w-[160px]', className)}
    >
      <span className="flex items-center gap-2 min-w-0 truncate">
        {selected?.leading}
        <span className="truncate">{label}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
    </Button>
  );

  const triggerEl = trigger
    ? (trigger({ open, label }) as React.ReactElement)
    : defaultTrigger;

  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      trigger={triggerEl}
      title={title}
      description={description}
      align={align}
      contentId={contentId}
    >
      <ul role="listbox" aria-label={ariaLabel} className="py-1 px-1.5">
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm',
                  'min-h-[44px] transition-colors duration-[var(--liquid-motion-fast)]',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50',
                  isSelected && 'bg-accent/60',
                )}
              >
                {opt.leading && <span className="shrink-0">{opt.leading}</span>}
                <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                {opt.hint && (
                  <span className="text-xs text-muted-foreground shrink-0">{opt.hint}</span>
                )}
                {isSelected && (
                  <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </AdaptivePopover>
  );
}
