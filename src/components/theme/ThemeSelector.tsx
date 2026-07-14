import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Monitor, Sun, Moon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const themes = [
  { value: 'system', labelKey: 'theme.system', icon: Monitor, fallback: 'Sistema' },
  { value: 'light', labelKey: 'theme.light', icon: Sun, fallback: 'Claro' },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon, fallback: 'Oscuro' },
] as const;

export function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-2" aria-hidden="true">
        {themes.map((t) => (
          <div key={t.value} className="h-11 flex-1 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex gap-2"
      role="radiogroup"
      aria-label={t('profile.appearance', 'Apariencia')}
    >
      {themes.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        const label = t(option.labelKey, option.fallback);

        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            variant={isActive ? 'default' : 'outline'}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex-1 gap-2 min-h-11',
              isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
            {isActive && <Check className="h-3.5 w-3.5 opacity-80" aria-hidden />}
          </Button>
        );
      })}
    </div>
  );
}
