import { describe, it, expect } from 'vitest';
import {
  sportImageKey,
  resolveSportImage,
  sportItemKind,
  sportPriceState,
} from '@/lib/sportsDisplay';

describe('sportImageKey', () => {
  it('maps known disciplines to their illustration family', () => {
    expect(sportImageKey('baloncesto')).toBe('baloncesto');
    expect(sportImageKey('Fútbol')).toBe('futbol');
    expect(sportImageKey('futsal')).toBe('futbol');
    expect(sportImageKey('natacion')).toBe('acuaticos');
    expect(sportImageKey('padel')).toBe('raqueta');
    expect(sportImageKey('motociclismo')).toBe('motor');
  });

  it('falls back to the neutral illustration for unknown or missing sports', () => {
    expect(sportImageKey(undefined)).toBe('otros');
    expect(sportImageKey('curling')).toBe('otros');
  });
});

describe('resolveSportImage', () => {
  it('prefers the real poster when the source published a usable one', () => {
    const res = resolveSportImage('https://example.org/poster.jpg', 'futbol');
    expect(res.illustrative).toBe(false);
    expect(res.src).toBe('https://example.org/poster.jpg');
  });

  it('marks the discipline illustration as illustrative', () => {
    expect(resolveSportImage(null, 'baloncesto').illustrative).toBe(true);
    // a source's generic placeholder must not pass as a poster
    expect(resolveSportImage('https://example.org/img/no-image.png', 'futbol').illustrative).toBe(true);
  });
});

describe('sportItemKind', () => {
  it('detects matches from the teams field', () => {
    expect(sportItemKind({ title: 'Jornada 5', teams: 'Unicaja - Real Madrid' })).toBe('match');
    expect(sportItemKind({ title: 'Málaga CF vs Cádiz' })).toBe('match');
  });

  it('detects competitions', () => {
    expect(sportItemKind({ title: 'Campeonato de Andalucía de natación' })).toBe('tournament');
    expect(sportItemKind({ title: 'Gala', competition: 'Liga Endesa' })).toBe('tournament');
  });

  it('treats everything else as an activity', () => {
    expect(sportItemKind({ title: 'Ruta ciclista popular' })).toBe('activity');
  });
});

describe('sportPriceState', () => {
  it('only says free when the source says so', () => {
    expect(sportPriceState('Entrada libre')).toBe('free');
    expect(sportPriceState('Gratis')).toBe('free');
  });

  it('reports a published amount as known', () => {
    expect(sportPriceState('Desde 12 €')).toBe('known');
  });

  it('never guesses when the source published nothing', () => {
    expect(sportPriceState(null)).toBe('unknown');
    expect(sportPriceState('   ')).toBe('unknown');
  });
});
