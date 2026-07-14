import { useTranslation } from 'react-i18next';
import { Calendar, Baby, Pill, Map as MapIcon, Landmark, Trophy, Radar } from 'lucide-react';

const INSTITUTIONAL_CARDS = [
  { icon: Calendar, key: 'agenda' },
  { icon: Baby, key: 'family' },
  { icon: Pill, key: 'pharmacies' },
  { icon: MapIcon, key: 'map' },
  { icon: Landmark, key: 'province' },
  { icon: Trophy, key: 'sportsLayer' },
] as const;

const InstitutionalStrip = () => {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl bg-card border border-border shadow-soft p-5 sm:p-6">
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-primary font-semibold mb-2">
          <Radar className="h-3.5 w-3.5" aria-hidden />
          {t('home.institutional.eyebrow')}
        </div>
        <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight">
          {t('home.institutional.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          {t('home.institutional.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {INSTITUTIONAL_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border border-border bg-muted/40 p-3 flex items-start gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
              <c.icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight">{t(`home.institutional.${c.key}.label`)}</div>
              <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t(`home.institutional.${c.key}.copy`)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { n: '35+', l: t('home.stats.venues') },
          { n: '24', l: t('home.stats.municipalities') },
          { n: '70+', l: t('home.stats.sources') },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-muted/50 border border-border px-2 py-2 text-center">
            <div className="font-display text-base font-semibold text-primary">{s.n}</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground italic">
        {t('home.stats.footer')}
      </p>
    </section>
  );
};

export default InstitutionalStrip;
