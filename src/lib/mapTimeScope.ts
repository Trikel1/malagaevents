export type MapTimeScope = 'today' | 'week' | 'all';

const TZ = 'Europe/Madrid';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD for a date in Europe/Madrid. */
export const madridDay = (date: Date | string): string | null => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return dayFormatter.format(d);
};

/** Sunday (inclusive) that closes the week containing `day` (Mon-Sun), as YYYY-MM-DD. */
export const madridWeekEnd = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay(); // 0 = Sunday
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  utc.setUTCDate(utc.getUTCDate() + daysToSunday);
  return utc.toISOString().slice(0, 10);
};

/**
 * Inclusive scope check for a dated item.
 * Undated items (venues, pharmacies) are always in scope.
 */
export const isWithinScope = (
  startAt: string | null | undefined,
  scope: MapTimeScope,
  now: Date = new Date()
): boolean => {
  if (scope === 'all') return true;
  if (!startAt) return true;
  const day = madridDay(startAt);
  if (!day) return true;
  const today = madridDay(now)!;
  if (scope === 'today') return day === today;
  return day >= today && day <= madridWeekEnd(today);
};

export const SCOPE_LABEL: Record<MapTimeScope, string> = {
  today: 'Mostrando eventos de hoy',
  week: 'Mostrando eventos de esta semana',
  all: 'Mostrando todos los eventos',
};
