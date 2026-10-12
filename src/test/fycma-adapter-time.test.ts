import { describe, it, expect } from 'vitest';
import { normalizeFycmaEvent } from '../../supabase/functions/_shared/adapters/fycma';

const base = { id: 1, title: 'Revolver', url: 'https://fycma.com/evento/revolver/' };

describe('FYCMA times', () => {
  it('Dec 12 21:00 Madrid stays 21:00 Madrid (20:00Z)', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00', utc_start_date: '2026-12-12 20:00:00' });
    expect(r.normalized?.startAt).toBe('2026-12-12T20:00:00.000Z');
  });
  it('wall-time fallback is also correct in winter', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-12-12 21:00:00' });
    expect(r.normalized?.startAt).toBe('2026-12-12T20:00:00.000Z');
  });
  it('multi-day congress keeps its end date', () => {
    const r = normalizeFycmaEvent({ ...base, start_date: '2026-10-15 09:00:00', end_date: '2026-10-16 18:00:00' });
    expect(r.normalized?.endAt).toBe('2026-10-16T16:00:00.000Z');
    expect(r.normalized?.isMultiDay).toBe(true);
  });
});
