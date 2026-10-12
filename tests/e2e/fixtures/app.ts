import { test as base, expect } from '@playwright/test';

export const cultureId = '11111111-1111-4111-8111-111111111111';
export const sportId = '22222222-2222-4222-8222-222222222222';
export const culture = {
  id: cultureId, title: 'Concierto QA Málaga', description: 'Evento cultural de prueba',
  category: 'music', start_at: '2026-10-12T18:00:00Z', end_at: '2026-10-12T20:00:00Z',
  venue_name: 'Teatro Cervantes', address: 'Calle Ramos Marín, Málaga',
  lat: 36.724, lng: -4.419, is_free: true, status: 'published', tags: [],
  image_url: null, source_type: 'official_feed', venues: null, locations: null,
};
export const sport = {
  id: sportId, title: 'Partido QA Málaga', sport_category: 'baloncesto',
  start_datetime: '2026-10-12T18:00:00Z', start_date: '2026-10-12',
  end_datetime: '2026-10-12T20:00:00Z', venue_name: 'Palacio de Deportes José María Martín Carpena',
  city: 'Málaga', address: 'Calle Miguel de Mérida, Málaga',
  source_url: 'https://example.org/deporte', source_name: 'Fuente QA',
  status: 'scheduled', is_in_malaga_province: true, image_url: null,
  price_info: 'Gratis', teams: null, competition: null,
};
const pharmacy = {
  id: '33333333-3333-4333-8333-333333333333', name: 'Farmacia QA',
  address: 'Calle Larios 1', municipality: 'Málaga', phone: '952 123 456',
  lat: 36.72, lng: -4.42, date_from: '2026-10-12', date_to: '2026-10-12',
  source_ref: 'https://farmaciasguardia.farmaceuticos.com/',
};

// Freeze only Date: timers, animations and query retries keep running normally.
// The fixture responds through the same REST contracts used by the real hooks.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-10-12T08:00:00Z'));
    await page.addInitScript(() => {
      localStorage.setItem('malaga-events-lang', 'es');
      if (!localStorage.getItem('appMode')) localStorage.setItem('appMode', 'eventos');
    });
    await page.route('**/rest/v1/**', async route => {
      const url = new URL(route.request().url());
      const table = url.pathname.split('/').pop();
      let rows: Record<string, unknown>[] = [];
      if (table === 'events') rows = [culture];
      if (table === 'sports_events') rows = [sport];
      if (table === 'pharmacies_guard' || table === 'pharmacies_directory') rows = [pharmacy];
      for (const [key, filter] of url.searchParams) {
        if (!(key in (rows[0] ?? {}))) continue;
        if (filter.startsWith('eq.')) rows = rows.filter(r => String(r[key]) === filter.slice(3));
        if (filter.startsWith('neq.')) rows = rows.filter(r => String(r[key]) !== filter.slice(4));
        if (filter.startsWith('gte.')) rows = rows.filter(r => String(r[key]) >= filter.slice(4));
        if (filter.startsWith('lte.')) rows = rows.filter(r => String(r[key]) <= filter.slice(4));
        if (filter.startsWith('lt.')) rows = rows.filter(r => String(r[key]) < filter.slice(3));
      }
      const single = url.searchParams.get('id')?.startsWith('eq.');
      await route.fulfill({
        contentType: 'application/json',
        headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
        body: JSON.stringify(single ? rows[0] ?? null : rows),
      });
    });
    await use(page);
  },
});
export { expect };
