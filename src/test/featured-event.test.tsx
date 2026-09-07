/**
 * Home hero regressions.
 *
 * The committed English screenshot read "Tuesday 8 De September · 02:00" for a
 * date-only course: the Spanish pattern leaked into English and the midnight
 * UTC sentinel was rendered as a real Madrid hour. These tests render the real
 * component with the real translations in ES and EN.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import FeaturedEvent from '@/components/home/FeaturedEvent';
import { pickFeaturedEvent } from '@/lib/featuredEvent';

let events: any[] = [];

vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({ data: events, isLoading: false }),
}));

vi.mock('@/components/events/EventImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
  EventImageSkeleton: () => null,
}));

const dateOnly = {
  id: 'a',
  title: 'Curso de modelado 3D',
  category: 'courses',
  start_at: '2026-09-08T00:00:00.000Z',
  venue_name: 'Online',
  is_free: true,
};

const timed = {
  id: 'b',
  title: 'Concierto en el Teatro Cervantes',
  category: 'music',
  start_at: '2026-09-12T18:30:00.000Z', // 20:30 Madrid
  venue_name: 'Teatro Cervantes',
  address: 'Calle Ramos Marín, s/n',
  lat: 36.7,
  lng: -4.4,
  is_free: false,
  price_info: '20 €',
};

const renderHero = () =>
  render(
    <MemoryRouter>
      <FeaturedEvent />
    </MemoryRouter>,
  );

describe('FeaturedEvent date rendering', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
  });
  afterAll(async () => {
    await i18n.changeLanguage('es');
  });

  it('shows the translated "time to be confirmed" label for a date-only event', async () => {
    events = [dateOnly];
    renderHero();
    expect(screen.getByText(/Hora por confirmar/i)).toBeTruthy();
    expect(screen.queryByText(/02:00/)).toBeNull();
  });

  it('shows the label in English, with an English month name', async () => {
    events = [dateOnly];
    await i18n.changeLanguage('en');
    renderHero();
    const line = screen.getByText(/Time to be confirmed/i).textContent ?? '';
    expect(line).toContain('September');
    expect(line).not.toMatch(/\bde\b/i);
    expect(line).not.toMatch(/\d{2}:\d{2}/);
  });

  it('shows the real Madrid hour for an event with an explicit time', () => {
    events = [timed];
    renderHero();
    expect(screen.getByText(/20:30/)).toBeTruthy();
  });
});

describe('featured selection', () => {
  it('prefers a located, dated, physical plan over an online course with a poster', () => {
    const online = { ...dateOnly, image_url: 'https://example.com/poster.jpg' };
    expect(pickFeaturedEvent([online, timed])?.id).toBe('b');
  });

  it('falls back to the soonest event when nothing scores better', () => {
    const later = { ...dateOnly, id: 'c', start_at: '2026-09-20T00:00:00.000Z' };
    expect(pickFeaturedEvent([later, dateOnly])?.id).toBe('a');
  });

  it('returns null when there is nothing upcoming', () => {
    expect(pickFeaturedEvent([])).toBeNull();
  });
});
