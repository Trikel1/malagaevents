import { useTranslation } from 'react-i18next';
import { Search, Trophy, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SportsHeroProps {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Dedicated hero for /sports. Not reused across cultural pages.
 * Mediterranean blue base with a green accent to signal "sports".
 */
const SportsHero = ({ value, onChange }: SportsHeroProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="relative overflow-hidden border-b border-border/60"
      aria-labelledby="sports-hero-title"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-emerald-500/10"
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-[1180px] px-4 lg:px-8 pt-8 pb-10 lg:pt-14 lg:pb-14">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-semibold tracking-wide">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          {t('sports.heroKicker', 'Agenda deportiva')}
        </div>

        <h1
          id="sports-hero-title"
          className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t(
              'sports.heroSearchPlaceholder',
              'Buscar deporte, equipo, competición o recinto',
            )}
            aria-label={t('sports.heroSearchPlaceholder', 'Buscar deporte, equipo, competición o recinto')}
            className="pl-9 pr-10 h-12 rounded-full bg-card border-border/70"
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
