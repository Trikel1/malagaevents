import { describe, it, expect } from 'vitest';
import { sanitizeEventImageUrl } from './eventImageSource';

describe('generic venue stand-ins', () => {
  it('rejects the FYCMA "event without photo" filler', () => {
    expect(sanitizeEventImageUrl('https://fycma.com/wp-content/uploads/2021/01/Eventos-sin-foto.jpg')).toBeNull();
  });
  it('keeps a real Estepona poster and upgrades it to https', () => {
    expect(
      sanitizeEventImageUrl('http://teatroestepona.com/wp-content/uploads/2026/01/luis-piedrahita.jpg')
    ).toBe('https://teatroestepona.com/wp-content/uploads/2026/01/luis-piedrahita.jpg');
  });
});
