import { describe, it, expect } from 'vitest';
import {
  canonicalCategory,
  CANONICAL_CATEGORIES,
} from '../../supabase/functions/_shared/ingestion/normalize';

describe('canonicalCategory', () => {
  it('deja intactas las claves canónicas', () => {
    for (const key of CANONICAL_CATEGORIES) {
      expect(canonicalCategory(key)).toBe(key);
    }
  });

  it('traduce las categorías reales del CSV de datos abiertos', () => {
    expect(canonicalCategory('Cursos y talleres')).toBe('workshops');
    expect(canonicalCategory('Fiestas populares')).toBe('festivals');
    expect(canonicalCategory('Música')).toBe('music');
    expect(canonicalCategory('Espectaculos')).toBe('theater');
    expect(canonicalCategory('Deportes')).toBe('sports');
    expect(canonicalCategory('Actos religiosos')).toBe('festivals');
    expect(canonicalCategory('Ferias, Exposiciones y Museos')).toBe('exhibitions');
    expect(canonicalCategory('Otros eventos')).toBe('other');
  });

  it('usa "other" para valores vacíos o desconocidos', () => {
    expect(canonicalCategory(null)).toBe('other');
    expect(canonicalCategory('')).toBe('other');
    expect(canonicalCategory('   ')).toBe('other');
    expect(canonicalCategory('lorem ipsum')).toBe('other');
  });

  it('no inventa categorías fuera del conjunto canónico', () => {
    const samples = ['Concierto de flamenco', 'Teatro infantil', 'Exposición', 'DJ set'];
    for (const sample of samples) {
      expect(CANONICAL_CATEGORIES).toContain(canonicalCategory(sample));
    }
  });

  it('prioriza público infantil sobre el formato', () => {
    expect(canonicalCategory('Teatro infantil')).toBe('kids');
  });
});
