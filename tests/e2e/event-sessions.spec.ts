import fs from 'node:fs/promises';
import { test, expect, culture, cultureId } from './fixtures/app';

const sessions = [
  { id: 'second', event_id: cultureId, start_datetime: '2027-04-24T18:30:00Z', end_datetime: null, buy_url: 'https://www.giglon.com/todos?idEvent=qa-second', sold_out: false },
  { id: 'first', event_id: cultureId, start_datetime: '2027-04-24T15:30:00Z', end_datetime: null, buy_url: 'https://www.giglon.com/todos?idEvent=qa-first', sold_out: false },
];

async function mockSessions(page: import('@playwright/test').Page, rows: unknown[]) {
  await page.route('**/rest/v1/events?**', route => {
    const url = new URL(route.request().url());
    const record = { ...culture, start_at: '2027-04-24T15:30:00Z', end_at: '2027-04-24T16:30:00Z', event_occurrences: url.searchParams.get('select')?.includes('event_occurrences(') ? rows : undefined };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(url.searchParams.get('id')?.startsWith('eq.') ? record : [record]) });
  });
}

test('detalle: elegir la segunda sesión cambia hora, entradas y calendario', async ({ page }) => {
  await mockSessions(page, sessions);
  await page.goto(`/events/${cultureId}`);
  const group = page.getByRole('group', { name: 'Sesiones' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('radio')).toHaveCount(2);
  await expect(group.getByRole('radio').first()).toBeChecked();
  await group.getByRole('radio').nth(1).check();
  await expect(group.getByRole('radio').nth(1)).toBeChecked();
  await expect(page.getByRole('link', { name: /Ver entradas/ }).first()).toHaveAttribute('href', sessions[0].buy_url);
  const downloading = page.waitForEvent('download');
  await page.getByRole('main').getByRole('button', { name: 'Añadir al calendario', exact: true }).click();
  const download = await downloading;
  const ics = await fs.readFile((await download.path())!, 'utf8');
  expect(ics).toContain('DTSTART:20270424T183000Z');
  expect(ics).not.toContain('DTEND:');
  expect(ics).toContain('second');
});

test('detalle: fechas inválidas no crean sesiones y un evento simple conserva su calendario', async ({ page }) => {
  await mockSessions(page, [sessions[1], { ...sessions[0], start_datetime: 'invalid' }]);
  await page.goto(`/events/${cultureId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Sesiones' })).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('main').getByRole('button', { name: 'Añadir al calendario', exact: true }).click();
  const ics = await fs.readFile((await (await downloading).path())!, 'utf8');
  expect(ics).toContain('DTSTART:20270424T153000Z');
  expect(ics).toContain('DTEND:20270424T163000Z');
});

test('detalle: hora desconocida y sesión agotada se presentan sin inventar disponibilidad', async ({ page }) => {
  await mockSessions(page, [{ ...sessions[1], start_datetime: '2027-04-24T00:00:00Z' }, { ...sessions[0], sold_out: true }]);
  await page.goto(`/events/${cultureId}`);
  const group = page.getByRole('group', { name: 'Sesiones' });
  await expect(group.getByText('Hora por confirmar')).toBeVisible();
  await expect(group.getByText('Agotado', { exact: true })).toBeVisible();
  await expect(group.getByRole('radio').nth(1)).toBeDisabled();
});
