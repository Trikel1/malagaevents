/**
 * Regressions for the normalized sports ingestion placement rules.
 *
 * Before this fix a missing venue silently became the source's default
 * municipality, every row claimed the province of Málaga, and non-sport
 * content (processions, concerts) leaked in through generic sources.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyDiscipline,
  findMunicipality,
  isPlaceholderVenue,
  resolvePlacement,
} from '../../supabase/functions/_shared/sports-sync/placement.ts';

describe('placement', () => {
  it('does not turn a missing venue into the default municipality', () => {
    const p = resolvePlacement({
      venueName: null,
      address: null,
      defaultMunicipality: 'Málaga',
    });
    expect(p.venueName).toBeNull();
    expect(p.municipality).toBeNull();
    expect(p.inMalagaProvince).toBe(false);
    expect(p.locationStatus).toBe('unverified');
  });

  it('treats placeholder venues as no venue at all', () => {
    for (const v of ['', 'N/A', 'por confirmar', 'Unknown', 'Costa del Sol']) {
      expect(isPlaceholderVenue(v)).toBe(true);
    }
    expect(isPlaceholderVenue('Palacio de Deportes José María Martín Carpena')).toBe(false);
  });

  it('verifies the municipality from a real address', () => {
    const p = resolvePlacement({
      venueName: 'Estadio La Rosaleda',
      address: 'Paseo de Martiricos, 29011 Málaga',
      defaultMunicipality: 'Málaga',
    });
    expect(p.municipality).toBe('Málaga');
    expect(p.inMalagaProvince).toBe(true);
    expect(p.locationStatus).toBe('verified');
  });

  it('keeps a declared locality from JSON-LD over the source default', () => {
    const p = resolvePlacement({
      venueName: 'Pabellón Municipal',
      address: null,
      declaredLocality: 'Estepona',
      defaultMunicipality: 'Málaga',
    });
    expect(p.municipality).toBe('Estepona');
    expect(p.inMalagaProvince).toBe(true);
  });

  it('does not place an event in the province from a venue outside it', () => {
    const p = resolvePlacement({
      venueName: 'Wizink Center',
      address: 'Avenida Felipe II, Madrid',
      defaultMunicipality: 'Málaga',
    });
    expect(p.inMalagaProvince).toBe(false);
    expect(p.municipality).not.toBe('Málaga');
  });

  it('matches municipalities on whole words only', () => {
    expect(findMunicipality('Coín')).toBe('Coín');
    expect(findMunicipality('Alhaurín de la Torre')).toBe('Alhaurín de la Torre');
    expect(findMunicipality('sin localidad conocida')).toBeNull();
  });
});

describe('discipline classification', () => {
  it('excludes explicit non-sport content', () => {
    expect(classifyDiscipline('Procesión de Semana Santa', '', null).isNonSport).toBe(true);
    expect(classifyDiscipline('Concierto de jazz', 'en el teatro', null).isNonSport).toBe(true);
    expect(classifyDiscipline('Exposición de fotografía', '', null).isNonSport).toBe(true);
  });

  it('keeps culturally adjacent but real sport events', () => {
    const race = classifyDiscipline('Carrera solidaria de Navidad', '10 km por el centro', null);
    expect(race.isNonSport).toBe(false);
    expect(race.discipline).toBe('atletismo');
  });

  it('recognises the discipline from the actual text', () => {
    expect(classifyDiscipline('Málaga CF - Sevilla', 'partido de fútbol', null).discipline).toBe('futbol');
    expect(classifyDiscipline('Unicaja Baloncesto - Real Madrid', '', null).discipline).toBe('baloncesto');
  });

  it('does not claim a discipline it cannot read', () => {
    const unknown = classifyDiscipline('Evento municipal', '', null);
    expect(unknown.isNonSport === true || unknown.discipline === null).toBe(true);
  });
});
