import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowRight } from 'lucide-react';
import { categoryI18nKey } from '@/lib/categoryLabel';
import { formatEventWhen, hasExplicitTime } from '@/lib/eventTime';
import { madridDayKey } from '@/lib/madridTime';
import { sanitizeText } from '@/lib/sanitize';
import { sanitizeEventImageUrl } from '@/lib/eventImageSource';
import HomeEventImage from './HomeEventImage';
import type { Event } from '@/types';

/** Presentation variants limited to Home: other routes keep EventCard. */
export default function HomeEventCard({ event, compact = false, isFavorite, onToggleFavorite }: {
  event: Event; compact?: boolean; isFavorite?: boolean; onToggleFavorite?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const image = sanitizeEventImageUrl(event.image_url);
  const when = formatEventWhen(event.start_at, i18n.language, t('events.timeTBC'));
  const venue = event.venue?.name || event.venue_name;
  const dateTime = when ? hasExplicitTime(event.start_at) ? event.start_at : madridDayKey(new Date(event.start_at)) : undefined;
  return (
    <article className={`home-event-card ${compact ? 'home-event-card-compact' : ''}`} data-image={!!image}>
      <Link to={`/events/${event.id}`} aria-labelledby={titleId} className="home-event-link">
        {image && <HomeEventImage key={image} event={event} compact={compact} />}
        <div className="home-event-content">
          <p className="home-category">{t(`categories.${categoryI18nKey(event.category)}`)}</p>
          <h3 id={titleId}>{sanitizeText(event.title) || t('events.untitled')}</h3>
          <dl className="home-event-meta">
            <div><dt className="sr-only">{t('eventDetail.date')}</dt><dd><time dateTime={dateTime}>{when || t('events.timeTBC')}</time></dd></div>
            {venue && <div><dt className="sr-only">{t('eventDetail.place')}</dt><dd>{venue}</dd></div>}
            <div><dt className="sr-only">{t('eventDetail.price')}</dt><dd className="home-price" data-free={event.is_free}>
              {event.is_free ? t('common.free') : event.price_info || t('home.featured.priceUnknown')}
            </dd></div>
          </dl>
          {!compact && <span className="home-card-action">{t('home.featured.cta')} <ArrowRight className="home-arrow" size={16} aria-hidden /></span>}
        </div>
      </Link>
      {onToggleFavorite && <button type="button" className="home-favorite" aria-pressed={!!isFavorite}
        aria-label={`${t(isFavorite ? 'eventDetail.removeFavorite' : 'eventDetail.addFavorite')}: ${event.title}`}
        onClick={() => onToggleFavorite(event.id)}>
        <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden />
      </button>}
    </article>
  );
}
