import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleSelect, type SimpleSelectOption } from '@/components/ui/adaptive';

const themes = [
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
] as const;

export interface ThemeToggleProps {
  variant?: 'hero' | 'nav';
  className?: string;
}

export function ThemeToggle({ variant = 'hero', className }: ThemeToggleProps = {}) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHero = variant === 'hero';
  const btnClass = [
    'min-h-[44px] min-w-[44px] h-11 w-11 rounded-full',
    isHero
      ? 'bg-foreground/10 hover:bg-foreground/15 text-foreground dark:bg-white/15 dark:hover:bg-white/25 dark:text-white'
      : 'bg-muted hover:bg-muted/80 text-foreground',
    className ?? '',
  ].join(' ');

  const CurrentIcon = mounted
    ? resolvedTheme === 'dark'
      ? Moon
      : Sun
    : Sun;

  const ariaLabel = t('theme.toggle', 'Cambiar tema');

  const options: SimpleSelectOption<string>[] = themes.map(({ value, labelKey, icon: Icon }) => ({
    value,
    label: t(labelKey),
    leading: <Icon className="h-4 w-4" aria-hidden="true" />,
  }));

  return (
    <SimpleSelect
      value={theme ?? 'system'}
      onValueChange={setTheme}
      options={options}
      title={ariaLabel}
      ariaLabel={ariaLabel}
      align="end"
      trigger={({ open }) => (
        <Button
          type="button"
          variant="ghost"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={btnClass}
        >
          <CurrentIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    />
  );
}
