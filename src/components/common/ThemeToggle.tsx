import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Monitor, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';

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

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={btnClass}>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          aria-label={t('theme.toggle', 'Cambiar tema')}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {themes.map((option) => {
          const Icon = option.icon;
          const isActive = theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={isActive ? 'bg-accent' : ''}
            >
              <Icon className="mr-2 h-4 w-4" />
              {t(option.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
