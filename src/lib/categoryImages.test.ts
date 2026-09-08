import { describe, expect, it } from 'vitest';
import { CATEGORY_IMAGES, GENERAL_EVENT_IMAGE, categoryImageFor } from './categoryImages';

describe('categoryImageFor', () => {
  it('uses a kitchen illustration for food-handling courses instead of the generic one', () => {
    const image = categoryImageFor('other', 'Manipulación de Alimentos (Edición 20ª)');
    expect(image).not.toBe(GENERAL_EVENT_IMAGE);
    expect(image).toContain('gastronomia');
  });

  it('uses a training illustration for employment courses', () => {
    expect(categoryImageFor('other', 'Nóminas y Seguros Sociales (ADGD0018)')).toContain('empleo');
    expect(categoryImageFor('other', 'Formación en Competencias para el empleo')).toContain('empleo');
  });

  it('keeps film and book themes apart', () => {
    expect(categoryImageFor('other', 'Proyección de cortometrajes')).toContain('cine');
    expect(categoryImageFor('other', 'Club de lectura: novela negra')).toContain('literatura');
  });

  it('never overrides an explicit category', () => {
    expect(categoryImageFor('music', 'Manipulación de Alimentos')).toBe(CATEGORY_IMAGES.music);
  });

  it('falls back to the general agenda image when the title says nothing', () => {
    expect(categoryImageFor('other', 'Actividad municipal')).toBe(GENERAL_EVENT_IMAGE);
  });
});
