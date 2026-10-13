import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventImage, { IMAGE_LOAD_TIMEOUT_MS } from '@/components/events/EventImage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let intersect: IntersectionObserverCallback;
const props = { src: 'https://example.org/poster.jpg', alt: 'Poster QA', fallback: <img src="/fallback.jpg" alt="Fallback QA" /> };
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('EventImage loading budget', () => {
  it('replaces a stalled priority image and notifies its wrapper', () => {
    const onImageError = vi.fn();
    render(<EventImage {...props} priority onImageError={onImageError} />);
    advance(IMAGE_LOAD_TIMEOUT_MS - 1);
    expect(screen.getByRole('img', { name: 'Poster QA' })).toBeInTheDocument();
    advance(1);
    expect(screen.getByRole('img', { name: 'Fallback QA' })).toBeInTheDocument();
    expect(onImageError).toHaveBeenCalledTimes(1);
  });

  it('does not expire an off-screen lazy image', () => {
    render(<EventImage {...props} />);
    advance(IMAGE_LOAD_TIMEOUT_MS * 3);
    expect(screen.getByRole('img', { name: 'Poster QA' })).toBeInTheDocument();
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    advance(IMAGE_LOAD_TIMEOUT_MS);
    expect(screen.getByRole('img', { name: 'Fallback QA' })).toBeInTheDocument();
  });

  it('cancels the budget after a successful load', () => {
    const onImageError = vi.fn();
    render(<EventImage {...props} priority onImageError={onImageError} />);
    fireEvent.load(screen.getByRole('img', { name: 'Poster QA' }));
    advance(IMAGE_LOAD_TIMEOUT_MS * 2);
    expect(screen.getByRole('img', { name: 'Poster QA' })).toHaveClass('opacity-100');
    expect(onImageError).not.toHaveBeenCalled();
  });

  it('gives a new source its own budget and cancels the old one', () => {
    const { rerender } = render(<EventImage {...props} priority />);
    advance(IMAGE_LOAD_TIMEOUT_MS - 1);
    rerender(<EventImage {...props} src="https://example.org/next-poster.jpg" priority />);
    advance(1);
    expect(screen.getByRole('img', { name: 'Poster QA' })).toHaveAttribute('src', 'https://example.org/next-poster.jpg');
    fireEvent.load(screen.getByRole('img', { name: 'Poster QA' }));
    advance(IMAGE_LOAD_TIMEOUT_MS);
    expect(screen.queryByRole('img', { name: 'Fallback QA' })).not.toBeInTheDocument();
  });

  it('cleans up the timer when unmounted', () => {
    const onImageError = vi.fn();
    const { unmount } = render(<EventImage {...props} priority onImageError={onImageError} />);
    unmount();
    advance(IMAGE_LOAD_TIMEOUT_MS);
    expect(onImageError).not.toHaveBeenCalled();
  });

  it('does not hide a poster whose cached load event already happened', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(640);
    render(<EventImage {...props} priority />);
    advance(IMAGE_LOAD_TIMEOUT_MS);
    expect(screen.getByRole('img', { name: 'Poster QA' })).toHaveClass('opacity-100');
    expect(screen.queryByRole('img', { name: 'Fallback QA' })).not.toBeInTheDocument();
  });
});
