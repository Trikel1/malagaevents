import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Monitor, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const themes = [
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
] as const;

export function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-2">
        {themes.map((t) => (
          <div
            key={t.value}
            className="h-10 flex-1 bg-muted animate-pulse rounded-md"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {themes.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex-1 gap-2',
              isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(option.labelKey)}</span>
          </Button>
        );
      })}
    </div>
  );
}
