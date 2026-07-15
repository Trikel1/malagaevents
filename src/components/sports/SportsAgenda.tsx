import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  CalendarDays, MapPin, Ticket, ExternalLink, Radar, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSportsAgenda, type AgendaWindow } from '@/hooks/useSportsAgenda';
import { useSportsCalendarSources } from '@/hooks/useSportsCalendarSources';
import SportIcon from '@/components/sports/SportIcon';
import type { SportsEntity } from '@/types/sportsEntities';

const TIMEZONE = 'Europe/Madrid';

const WINDOWS: { key: AgendaWindow; labelKey: string; fallback: string }[] = [
  { key: 'today', labelKey: 'sportsAgenda.today', fallback: 'Hoy' },
  { key: '7d', labelKey: 'sportsAgenda.next7', fallback: 'Próximos 7 días' },
  { key: '30d', labelKey: 'sportsAgenda.next30', fallback: 'Próximos 30 días' },
  { key: 'all', labelKey: 'sportsAgenda.all', fallback: 'Todos' },
];

const TYPES = [
  { key: 'all' as const, labelKey: 'sportsAgenda.type.all', fallback: 'Todo' },
  { key: 'tournament' as const, labelKey: 'sportsAgenda.type.tournament', fallback: 'Torneos' },
  { key: 'match' as const, labelKey: 'sportsAgenda.type.match', fallback: 'Partidos' },
  { key: 'activity' as const, labelKey: 'sportsAgenda.type.activity', fallback: 'Actividades' },
];

function formatLastChecked(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatInTimeZone(new Date(iso), TIMEZONE, "d MMM yyyy", { locale: es });
}

function formatDate(iso: string): string {
  return formatInTimeZone(new Date(iso + 'T12:00:00Z'), TIMEZONE, "EEE d 'de' MMM", { locale: es });
}
function formatTime(t?: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

const AgendaCard = ({ e }: { e: SportsEntity }) => {
  const { t } = useTranslation();
  const timeStart = formatTime(e.time_start);
  const timeEnd = formatTime(e.time_end);

  return (
    <Card className="border-emerald-700/20 bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)]">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-200 flex items-center justify-center">
            {e.sport ? (
              <SportIcon sport={e.sport} className="h-5 w-5" />
            ) : (
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-700/25 uppercase tracking-wide"
              >
                {e.entity_type === 'tournament'
                  ? t('sportsAgenda.badge.tournament', 'Torneo')
                  : e.entity_type === 'match'
                  ? t('sportsAgenda.badge.match', 'Partido')
                  : t('sportsAgenda.badge.activity', 'Actividad')}
              </Badge>
              {e.sport && (
                <span className="text-[11px] text-muted-foreground capitalize">
                  {e.sport.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h3 className="text-[14px] font-semibold leading-tight text-foreground line-clamp-2">
              {e.name}
            </h3>
            <div className="mt-1.5 space-y-0.5 text-[12.5px] text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="capitalize">{e.date_start && formatDate(e.date_start)}</span>
                {timeStart && (
                  <span>
                    · {timeStart}
                    {timeEnd ? `–${timeEnd}` : ''}
                  </span>
                )}
              </p>
              {(e.address || e.district) && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {[e.address, e.district].filter(Boolean).join(' · ')}
                  </span>
                </p>
              )}
              {(e.price || e.registration_url) && (
                <p className="flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {e.price ?? t('sportsAgenda.registrationOpen', 'Inscripción')}
                  </span>
                </p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[12px]">
              {e.source_url && (
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline min-h-11 py-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('sportsAgenda.officialSource', 'Fuente oficial')}
                </a>
              )}
              {e.registration_url && e.registration_url !== e.source_url && (
                <a
                  href={e.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline min-h-11 py-2"
                >
                  {t('sportsAgenda.register', 'Inscribirse')}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SportsAgenda = () => {
  const { t } = useTranslation();
  const [win, setWin] = useState<AgendaWindow>('30d');
  const [type, setType] = useState<'all' | 'tournament' | 'match' | 'activity'>('all');
  const [sport, setSport] = useState<string>('all');

  const { data: events = [], isLoading } = useSportsAgenda({ window: win, type, sport });

  const sports = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.sport && set.add(e.sport));
    return Array.from(set).sort();
  }, [events]);

  return (
    <section
      aria-label={t('sportsAgenda.aria', 'Agenda deportiva de Málaga')}
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-1.5">
          <CalendarDays className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          {t('sportsAgenda.title', 'Agenda deportiva')}
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {t('sportsAgenda.verifiedOnly', 'Solo fuentes verificadas')}
        </span>
      </div>

      {/* Time-window chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {WINDOWS.map((w) => {
          const active = win === w.key;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => setWin(w.key)}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full px-3 min-h-11 text-[12.5px] font-semibold border transition-colors liquid-press',
                active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)] border-emerald-700/20 text-foreground',
              )}
            >
              {t(w.labelKey, w.fallback)}
            </button>
          );
        })}
      </div>

      {/* Type + sport filters */}
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((tp) => {
          const active = type === tp.key;
          return (
            <button
              key={tp.key}
              type="button"
              onClick={() => setType(tp.key)}
              aria-pressed={active}
              className={cn(
                'rounded-full px-2.5 min-h-9 text-[11.5px] font-medium border',
                active
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-transparent text-muted-foreground border-emerald-700/20 hover:text-foreground',
              )}
            >
              {t(tp.labelKey, tp.fallback)}
            </button>
          );
        })}
        {sports.length > 1 && (
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            aria-label={t('sportsAgenda.sportFilter', 'Filtrar por deporte')}
            className="rounded-full px-2.5 min-h-9 text-[11.5px] font-medium border border-emerald-700/20 bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="all">{t('sportsAgenda.allSports', 'Todos los deportes')}</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Verified events section */}
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-2">
          {t('sportsAgenda.verifiedTitle', 'Eventos verificados')}
        </h3>
        {isLoading ? (
          <Card className="border-emerald-700/20 bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)]">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t('common.loading', 'Cargando…')}
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card className="border-dashed border-emerald-700/25 bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)]">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {t(
                'sportsAgenda.emptyWindow',
                'No hay eventos verificados en este rango. Prueba a ampliar el filtro.',
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {events.map((e) => (
              <AgendaCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>

      {/* External federative & club calendars — honest state */}
      <PendingSourcesBlock />
    </section>
  );
};

const PendingSourcesBlock = () => {
  const { t } = useTranslation();
  const { data: sources = [], isLoading } = useSportsCalendarSources();

  const grouped = useMemo(() => {
    return {
      federation: sources.filter((s) => s.scope === 'federation'),
      club: sources.filter((s) => s.scope === 'club'),
    };
  }, [sources]);

  const renderItem = (s: (typeof sources)[number]) => {
    const checked = formatLastChecked(s.lastChecked);
    return (
      <li key={s.id}>
        <a
          href={s.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2 py-2 rounded-lg min-h-11 hover:bg-emerald-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <ExternalLink
            className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-medium truncate">{s.shortName}</span>
              <Badge
                variant="outline"
                className="text-[9.5px] px-1 py-0 border-emerald-700/25 uppercase tracking-wide"
              >
                {s.scope === 'federation'
                  ? t('sportsAgenda.scope.federation', 'Federación')
                  : t('sportsAgenda.scope.club', 'Club')}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground mt-0.5">
              <span className="uppercase tracking-wide">{s.sport}</span>
              <span aria-hidden="true">·</span>
              <span>
                {s.syncState === 'linked'
                  ? t('sportsAgenda.state.linked', 'Enlace oficial')
                  : t('sportsAgenda.state.pending', 'Sincronización pendiente')}
              </span>
              {checked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('sportsAgenda.checked', 'Comprobado')} {checked}
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </a>
      </li>
    );
  };

  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Radar className="h-3.5 w-3.5" aria-hidden="true" />
        {t('sportsAgenda.pendingTitle', 'Calendarios externos pendientes de sincronización')}
      </h3>
      <Card className="border-dashed border-emerald-700/20 bg-[hsl(160_28%_98%)] dark:bg-[hsl(190_28%_13%)]">
        <CardContent className="p-3">
          <p className="text-[12.5px] text-muted-foreground mb-2 leading-snug">
            {t(
              'sportsAgenda.pendingSubtitle',
              'Ninguno de estos calendarios expone un feed público estable. Enlazamos siempre a la fuente oficial y registramos la última comprobación.',
            )}
          </p>
          {isLoading ? (
            <p className="text-[12px] text-muted-foreground py-2">
              {t('common.loading', 'Cargando…')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {grouped.federation.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80 mb-0.5">
                    {t('sportsAgenda.scope.federations', 'Federaciones')}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {grouped.federation.map(renderItem)}
                  </ul>
                </div>
              )}
              {grouped.club.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80 mb-0.5">
                    {t('sportsAgenda.scope.clubs', 'Clubes')}
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {grouped.club.map(renderItem)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SportsAgenda;
