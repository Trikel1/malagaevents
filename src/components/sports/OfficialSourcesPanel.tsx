import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { useSportsOfficialSources } from '@/hooks/useSportsEntities';

/**
 * Compact "Fuentes oficiales" panel for the Sports landing.
 * Read-only. Renders nothing until data is loaded to avoid layout jumps.
 * Shows the most recent `source_last_checked` as an "Última comprobación"
 * signal, without dominating the page.
 */
const OfficialSourcesPanel = () => {
  const { t, i18n } = useTranslation();
  const { data: sources = [], isLoading } = useSportsOfficialSources();

  const lastChecked = useMemo(() => {
    const dates = sources
      .map((s) => s.source_last_checked)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d).getTime());
    if (!dates.length) return null;
    return new Date(Math.max(...dates));
  }, [sources]);

  if (isLoading || sources.length === 0) return null;

  return (
    <section aria-label={t('sportsHome.sources.aria', 'Fuentes oficiales de datos deportivos')}>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-base font-semibold tracking-tight flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          {t('sportsHome.sources.title', 'Fuentes oficiales')}
        </h2>
        {lastChecked && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t('sportsHome.sources.lastChecked', 'Última comprobación')}:{' '}
            {formatDistanceToNow(lastChecked, {
              addSuffix: true,
              locale: i18n.language.startsWith('es') ? es : undefined,
            })}
          </span>
        )}
      </div>
      <Card className="border-emerald-700/20 bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)]">
        <CardContent className="p-2.5">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.source_url ?? s.official_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-2 rounded-lg min-h-11 hover:bg-emerald-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  <span className="text-[13px] font-medium truncate flex-1">{s.name}</span>
                  {s.sport && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                      {s.sport}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[10.5px] text-muted-foreground mt-1.5 px-1 leading-snug">
            {t(
              'sportsHome.sources.footnote',
              'Datos verificados a partir de fuentes públicas del Ayuntamiento de Málaga, la Junta de Andalucía y federaciones oficiales.',
            )}
          </p>
        </CardContent>
      </Card>
    </section>
  );
};

export default OfficialSourcesPanel;
