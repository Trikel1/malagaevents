import { describe, it, expect } from 'vitest';
import {
  evaluateSportsEligibility,
  filterEligibleSports,
  isAwayFixture,
  findMalagaMunicipality,
} from './sportsEligibility';

const base = { source_url: 'https://example.org/x' };

describe('findMalagaMunicipality', () => {
  it('matches accent-insensitively on venue text', () => {
    expect(findMalagaMunicipality('Palacio de Deportes José María Martín Carpena, Málaga')).toBe('Málaga');
    expect(findMalagaMunicipality('Ciudad Deportiva de Benalmadena')).toBe('Benalmádena');
  });
  it('does not match venues outside the province', () => {
    expect(findMalagaMunicipality('Estadio ABANCA Balaídos, Vigo')).toBeNull();
    expect(findMalagaMunicipality('Coliseum, Getafe')).toBeNull();
  });
});

describe('isAwayFixture', () => {
  it('detects the local club listed as visitor', () => {
    expect(isAwayFixture({ title: 'Celta - Málaga CF' })).toBe(true);
    expect(isAwayFixture({ title: 'Deportivo Alavés vs Málaga CF' })).toBe(true);
  });
  it('does not flag home fixtures', () => {
    expect(isAwayFixture({ title: 'Málaga CF - Getafe' })).toBe(false);
  });
});

describe('evaluateSportsEligibility', () => {
  it('rejects arts content carrying a generic sport category', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Espectáculo Ronda Flamenca',
      sport_category: 'other',
      venue_name: 'Plaza de Toros, Ronda',
    });
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('non_sport_content');
  });

  it('rejects a religious procession', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Procesión y traslado de la Hermandad',
      sport_category: 'other',
      venue_name: 'Iglesia de Santiago, Málaga',
    });
    expect(v.reason).toBe('non_sport_content');
  });

  it('rejects an away fixture pinned to Málaga by the city column', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Celta - Málaga CF',
      competition: 'LaLiga Hypermotion',
      city: 'Málaga',
      venue_name: 'Estadio ABANCA Balaídos',
    });
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('away_fixture');
  });

  it('marks as provisional a row whose locality is only supported by the city column', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Torneo de pádel',
      city: 'Málaga',
      venue_name: 'Club deportivo El Candado',
    });
    expect(v.eligible).toBe(true);
    expect(v.tier).toBe('provisional');
    expect(v.localityVerified).toBe(false);
  });

  it('omits a row with a placeholder venue and no address', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'XV Torneo Costa del Sol de baloncesto',
      sport_category: 'baloncesto',
      city: 'Malaga',
      venue_name: 'Not specified',
    });
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('locality_unverified');
  });

  it('rejects rows without provenance', () => {
    const v = evaluateSportsEligibility({ title: 'Carrera popular', venue_name: 'Málaga' });
    expect(v.reason).toBe('no_provenance');
  });

  it('accepts a home fixture with venue evidence', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Unicaja Baloncesto - Real Madrid',
      competition: 'Liga Endesa',
      venue_name: 'Palacio de Deportes Martín Carpena, Málaga',
    });
    expect(v.eligible).toBe(true);
    expect(v.tier).toBe('verified');
    expect(v.discipline).toBe('baloncesto');
    expect(v.localityVerified).toBe(true);
    expect(v.municipality).toBe('Málaga');
  });

  it('classifies trialbici as cycling, not motor sport', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Exhibición de Trialbici',
      address: 'Avenida de Andalucía, Torremolinos',
    });
    expect(v.discipline).toBe('ciclismo');
  });

  it('describes a scooter gathering as a meet, not a race', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Concentración de Vespas y Lambretas',
      address: 'Paseo Marítimo, Fuengirola',
    });
    expect(v.discipline).toBe('motor');
    expect(v.kind).toBe('meet');
    expect(v.disciplineDetail).toContain('no es competición');
  });

  it('keeps a charity race despite civic wording', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Carrera solidaria por la infancia',
      address: 'Parque del Oeste, Málaga',
    });
    expect(v.eligible).toBe(true);
    expect(v.discipline).toBe('atletismo');
  });

  it('never infers basketball from the Unicaja brand alone', () => {
    const v = evaluateSportsEligibility({
      ...base,
      title: 'Concierto en la Fundación Unicaja',
      venue_name: 'Sala Unicaja, Málaga',
    });
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('non_sport_content');
  });
});

describe('filterEligibleSports', () => {
  it('reports an honest omission tally', () => {
    const summary = filterEligibleSports([
      { ...base, title: 'Espectáculo Ronda Flamenca', venue_name: 'Ronda' },
      { ...base, title: 'Celta - Málaga CF', venue_name: 'Balaídos', competition: 'LaLiga' },
      { ...base, title: 'Carrera popular', address: 'Marbella' },
    ]);
    expect(summary.eligible).toHaveLength(1);
    expect(summary.omitted).toBe(2);
    expect(summary.reasons.non_sport_content).toBe(1);
    expect(summary.reasons.away_fixture).toBe(1);
    expect(summary.verified).toBe(1);
    expect(summary.provisional).toBe(0);
  });
});
