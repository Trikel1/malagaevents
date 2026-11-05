import { useTranslation } from 'react-i18next';
import type { Locale } from 'date-fns';
import type { Event } from '@/types';
import { formatMadrid } from '@/lib/madridTime';
import { formatEventTime } from '@/lib/eventTime';
import { cn } from '@/lib/utils';

type Session = NonNullable<Event['occurrences']>[number];

/** Invalid source timestamps cannot be formatted or exported. Keep real sessions distinct. */
export function eventSessions(event: Event): Session[] {
  const seen = new Set<string>();
  return (event.occurrences ?? []).filter(session => {
    if (!session.id || seen.has(session.id) || !Number.isFinite(Date.parse(session.start_datetime))) return false;
    seen.add(session.id);
    return true;
  }).sort((a, b) => Date.parse(a.start_datetime) - Date.parse(b.start_datetime));
}

export default function EventSessions({ sessions, selectedId, onSelect, locale }: {
  sessions: Session[];
  selectedId?: string;
  onSelect: (id: string) => void;
  locale: Locale;
}) {
  const { t, i18n } = useTranslation();
  if (sessions.length < 2) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-base font-semibold">{t('eventDetail.sessions')}</legend>
      {sessions.map(session => (
        <label key={session.id} className={cn('flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3',
          selectedId === session.id ? 'border-primary bg-primary/5' : 'border-border bg-card',
          session.sold_out && 'cursor-not-allowed opacity-60')}>
          <input type="radio" name="event-session" value={session.id} checked={selectedId === session.id}
            disabled={session.sold_out === true} onChange={() => onSelect(session.id)} className="h-4 w-4 shrink-0 accent-primary" />
          <span className="min-w-0 text-sm">
            <time dateTime={session.start_datetime} className="block font-medium">
              {formatMadrid(new Date(session.start_datetime), 'EEE d MMM yyyy', locale)}
              {' · '}{formatEventTime(session.start_datetime, i18n.language, t('events.timeTBC'))}
            </time>
            {session.sold_out && <span className="block text-muted-foreground">{t('eventDetail.soldOut')}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
