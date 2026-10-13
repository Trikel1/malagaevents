import { describe, expect, it } from 'vitest';
import { formatEventTime, formatEventWhen, hasExplicitTime } from '@/lib/eventTime';
import { dateLocale } from '@/lib/dateLocale';

describe('event time certainty and Madrid presentation', () => {
  for (const [language, unknown] of [['es', 'Hora por confirmar'], ['en', 'Time to be confirmed'], ['de', 'Uhrzeit folgt'], ['ar', 'الوقت غير مؤكد']]) {
    it(`${language}: date-only and UTC midnight never manufacture an hour`, () => {
      for (const date of ['2026-10-13', '2026-10-13T00:00:00Z', '2026-01-13T00:00:00Z']) {
        expect(formatEventTime(date, language, unknown)).toBe(unknown);
        expect(formatEventWhen(date, language, unknown)).toContain(unknown);
        expect(formatEventWhen(date, language, unknown)).not.toMatch(/0[012]:00/);
      }
      expect(dateLocale(language).code).toMatch(new RegExp(`^${language}`));
    });
  }
  it('explicit hours follow Madrid DST, never the device timezone', () => {
    expect(formatEventTime('2026-07-13T18:00:00Z', 'en', 'unknown')).toBe('20:00');
    expect(formatEventTime('2026-01-13T18:00:00Z', 'de', 'unknown')).toBe('19:00');
    expect(formatEventTime('2026-10-25T01:30:00Z', 'es', 'unknown')).toBe('02:30');
  });
  it('Arabic dates use the requested locale', () => {
    expect(formatEventWhen('2026-10-13T18:00:00Z', 'ar', 'unknown')).toContain('أكتوبر');
  });
  it('invalid and absent dates are not presented as concrete times', () => {
    expect(hasExplicitTime('invalid')).toBe(false);
    expect(formatEventWhen('invalid', 'en', 'unknown')).toBe('');
    expect(formatEventWhen(null, 'en', 'unknown')).toBe('');
  });
});
