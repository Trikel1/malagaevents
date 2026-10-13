import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import EventImage from '@/components/events/EventImage';
import { sanitizeEventImageUrl } from '@/lib/eventImageSource';
import type { Event } from '@/types';

/** Home-only framing; the shared image loader still handles errors and URLs. */
export default function HomeEventImage({ event, compact = false, priority = false }: {
  event: Event; compact?: boolean; priority?: boolean;
}) {
  const { t } = useTranslation();
  const [portrait, setPortrait] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasPoster = Boolean(sanitizeEventImageUrl(event.image_url));
  const handleImageError = useCallback(() => setFailed(true), []);
  return (
    <figure className="home-event-image" data-portrait={portrait} data-failed={failed}
      onLoadCapture={e => {
        if (!hasPoster || failed) return;
        const image = e.target as HTMLImageElement;
        setPortrait(image.naturalHeight > image.naturalWidth);
      }}>
      <EventImage src={event.image_url} alt={event.title} title={event.title}
        category={event.category} variant={compact ? 'compact' : 'card'}
        aspectRatio={compact ? '1/1' : '16/10'} priority={priority} onImageError={handleImageError} />
      {compact && (failed || !hasPoster) && (
        <figcaption className="home-illustration-label">{t('image.illustrative')}</figcaption>
      )}
    </figure>
  );
}
