import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Monitor, Sun, Moon, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

/**
 * Compact theme toggle — anchored Radix Popover, identical on mobile and
 * desktop. Never renders a bottom sheet. 220–240px wide, aligned to the
 * right edge of the trigger with collisionPadding so it stays on-screen.
 */

type ThemeValue = 'system' | 'light' | 'dark';

const OPTIONS: { value: ThemeValue; labelKey: string; icon: typeof Sun }[] = [
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
];

export interface ThemeToggleProps {
  variant?: 'hero' | 'nav';
  className?: string;
}

export function ThemeToggle({ variant = 'hero', className }: ThemeToggleProps = {}) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHero = variant === 'hero';
  const ariaLabel = t('theme.toggle', 'Cambiar tema');

  const CurrentIcon = mounted
    ? resolvedTheme === 'dark'
      ? Moon
      : Sun
    : Sun;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={cn(
            'inline-flex items-center justify-center min-h-[44px] min-w-[44px] h-11 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isHero
              ? 'bg-foreground/10 hover:bg-foreground/15 text-foreground dark:bg-white/15 dark:hover:bg-white/25 dark:text-white'
              : 'bg-muted hover:bg-muted/80 text-foreground',
            className,
          )}
        >
          <CurrentIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="listbox"
          aria-label={ariaLabel}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 w-[228px] rounded-[16px] border border-border/70 bg-popover p-1.5 text-popover-foreground outline-none',
            'shadow-[0_16px_40px_-18px_hsl(220_34%_20%/0.28),0_4px_12px_hsl(220_34%_15%/0.08)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=open]:duration-[180ms] data-[state=closed]:duration-[160ms]',
          )}
        >
          {OPTIONS.map(({ value, labelKey, icon: Icon }) => {
            const selected = (theme ?? 'system') === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full min-h-[44px] flex items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm transition-colors',
                  'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                  selected && 'bg-primary/10 text-primary font-semibold',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{t(labelKey)}</span>
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
