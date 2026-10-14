import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export default function HomeModeSwitch({ value, onChange, editorial = false }: {
  value: 'eventos' | 'deportes'; onChange: (mode: 'eventos' | 'deportes') => void; editorial?: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className={cn('relative inline-grid grid-cols-2 rounded-full border border-border p-0.5 min-w-0 shrink-0 text-foreground bg-card overflow-hidden', editorial && 'home-mode')}>
      <span aria-hidden className="absolute top-0.5 bottom-0.5 start-0.5 rounded-full bg-primary transition-transform duration-300 motion-reduce:transition-none"
        style={{ width: 'calc(50% - 2px)', transform: `translateX(${value === 'eventos' ? '0%' : i18n.dir() === 'rtl' ? '-100%' : '100%'})` }} />
      {(['eventos', 'deportes'] as const).map(mode => (
        <button key={mode} type="button" onClick={() => onChange(mode)} aria-pressed={value === mode}
          className={cn('relative z-[1] px-3 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-300 min-h-[44px] whitespace-nowrap', value === mode ? 'text-primary-foreground' : 'text-foreground hover:text-foreground')}>
          {t(mode === 'eventos' ? 'sports.events' : 'sports.title')}
        </button>
      ))}
    </div>
  );
}
