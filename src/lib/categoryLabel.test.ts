import { describe, it, expect } from 'vitest';
import { categoryI18nKey } from './categoryLabel';

describe('categoryI18nKey', () => {
  it('keeps canonical keys', () => {
    expect(categoryI18nKey('theater')).toBe('theater');
  });
  it('never leaks raw source categories into the UI', () => {
    expect(categoryI18nKey('venue')).toBe('other');
    expect(categoryI18nKey('Cursos y talleres')).toBe('workshops');
    expect(categoryI18nKey('')).toBe('other');
    expect(categoryI18nKey(null)).toBe('other');
  });
});
