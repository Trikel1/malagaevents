import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import EventImage from '@/components/events/EventImage';
import { GENERAL_EVENT_IMAGE } from '@/lib/categoryImages';
import type { Event } from '@/types';

/** Home-only framing; the shared image loader still handles errors and URLs. */
export default function HomeEventImage({ event, compact = false, priority = false }: {
  event: Event; compact?: boolean; priority?: boolean;
}) {
  const { t } = useTranslation();
  const [portrait, setPortrait] = useState(false);
  const [failed, setFailed] = useState(false);
  const handleImageError = useCallback(() => setFailed(true), []);
  return (
    <figure className="home-event-image" data-portrait={portrait} data-failed={failed}
      onLoadCapture={e => {
        const image = e.target as HTMLImageElement;
        setPortrait(image.naturalHeight > image.naturalWidth);
      }}>
      <EventImage src={event.image_url} alt={event.title} title={event.title}
        category={event.category} variant={compact ? 'compact' : 'card'}
        aspectRatio={compact ? '1/1' : '16/10'} priority={priority} onImageError={handleImageError}
        fallback={<div className="home-image-fallback">
          <img src={GENERAL_EVENT_IMAGE} alt={t('image.illustrativeAlt', { category: t('image.categories.other') })}
            width={64} height={64} loading="eager" />
          <span>{t('image.illustrative')}</span>
        </div>} />
    </figure>
  );
}
