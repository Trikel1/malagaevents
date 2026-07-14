import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !full.includes('/test/')) out.push(full);
  }
  return out;
}

const files = walk(SRC);

describe('Sprint final — QA regressions', () => {
  it('no source uses h-screen; only h-dvh (viewport-safe on mobile)', () => {
    const bad: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, 'utf8');
      if (/\b(min-)?h-screen\b/.test(txt)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it('MainLayout does not render <main> (each page owns its own landmark)', () => {
    const txt = readFileSync(path.join(SRC, 'components/layout/MainLayout.tsx'), 'utf8');
    // Strip block comments so a reminder note mentioning <main> in prose is ignored.
    const code = txt.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/<main\b/);
  });

  it('every top-level page renders a <main> landmark', () => {
    const pages = [
      'pages/Index.tsx',
      'pages/EventsPage.tsx',
      'pages/CalendarPage.tsx',
      'pages/MapPage.tsx',
      'pages/PharmaciesPage.tsx',
      'pages/ProfilePage.tsx',
      'pages/TicketsPage.tsx',
      'pages/VenuesPage.tsx',
      'pages/AuthPage.tsx',
      'pages/ResetPasswordPage.tsx',
      'pages/AddTicketPage.tsx',
      'pages/SubmitEventPage.tsx',
      'pages/EventDetailPage.tsx',
      'pages/NotFound.tsx',
      'pages/AdminPage.tsx',
      'pages/MunicipalityAgendaPage.tsx',
      'components/sports/SportsEventsPage.tsx',
    ];
    const missing: string[] = [];
    for (const p of pages) {
      const txt = readFileSync(path.join(SRC, p), 'utf8');
      if (!/<main\b/.test(txt)) missing.push(p);
    }
    expect(missing).toEqual([]);
  });

  it('no raw i18n key surfaces in JSX (e.g. >sports.football<)', () => {
    const bad: { file: string; line: string }[] = [];
    for (const f of files) {
      // Skip translation JSON and i18n infra.
      if (f.includes('/i18n/')) continue;
      const txt = readFileSync(f, 'utf8');
      // Only match ">key.subkey<" literal patterns in JSX (not inside t('...') calls).
      const matches = txt.match(/>\s*(sports|events|calendar|profile|map|pharmacies|auth|venues)\.[a-zA-Z0-9._-]+\s*</g);
      if (matches) bad.push({ file: f, line: matches[0] });
    }
    expect(bad).toEqual([]);
  });
});
