import { useTranslation } from 'react-i18next';
import { Search, Trophy, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SportsHeroProps {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Dedicated hero for /sports. Aligned with the approved Málaga Events
 * brand system: primary/secondary tokens, gradient accents, Space Grotesk display.
 */
const SportsHero = ({ value, onChange }: SportsHeroProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden border-b border-border/60 bg-card"
      aria-labelledby="sports-hero-title"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]">
        <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-primary blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-secondary blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1240px] px-4 lg:px-8 pt-8 pb-8 lg:pt-12 lg:pb-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/12 text-secondary border border-secondary/30 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          {t('sports.heroKicker', 'Agenda deportiva')}
        </div>

        <h1
          id="sports-hero-title"
          className="mt-4 font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-foreground leading-[1.05]"
        >
          {t('sports.pageTitle', 'Deporte en Málaga')}
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          {t(
            'sports.pageSubtitle',
            'Competiciones, actividades, entrenamientos y recintos deportivos en Málaga y su provincia.',
          )}
        </p>

        <div className="relative mt-6 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t(
              'sports.heroSearchPlaceholder',
              'Buscar deporte, equipo, competición o recinto',
            )}
            aria-label={t('sports.heroSearchPlaceholder', 'Buscar deporte, equipo, competición o recinto')}
            className="pl-11 pr-11 h-12 rounded-2xl bg-background border-border/70 shadow-sm"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t('common.clear', 'Limpiar')}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default SportsHero;
