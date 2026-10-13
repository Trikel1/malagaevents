import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { formatMadrid, madridDayKey } from '@/lib/madridTime';
import { hasExplicitTime, formatEventTime } from '@/lib/eventTime';
import { dateLocale, longDatePattern } from '@/lib/dateLocale';
import { pickFeaturedEvent } from '@/lib/featuredEvent';
import { Button } from '@/components/ui/button';
import HomeEventImage from './HomeEventImage';

export default function FeaturedEvent({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useEvents({ limit: 24, enabled: true });
  const featured = pickFeaturedEvent(data ?? []);
  useEffect(() => { onSelect?.(featured?.id ?? null); }, [featured?.id, onSelect]);
  if (isLoading) return <div role="status" aria-label={t('common.loading')} className="home-notice">
    <div aria-hidden className="h-40 rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />
  </div>;
  if (isError) return <section className="home-notice" role="alert">
    <h2 className="home-section-title">{t('home.pilot.featuredError')}</h2>
    <p className="home-note">{t('errors.loadFailedDesc')}</p>
    <Button onClick={() => refetch()}>{t('common.retry')}</Button>
  </section>;
  if (!featured) return null;
  const date = formatMadrid(featured.start_at, longDatePattern(i18n.language), dateLocale(i18n.language));
  const time = formatEventTime(featured.start_at, i18n.language, t('events.timeTBC'));
  const today = madridDayKey(new Date(featured.start_at)) === madridDayKey();
  return (
    <section className="home-featured" aria-labelledby="featured-event-title">
      <Link to={`/events/${featured.id}`} className="home-featured-link" data-image="true">
        <HomeEventImage key={featured.id + (featured.image_url ?? '')} event={featured} priority />
        <div className="home-featured-content">
          <p className="home-category">{t(today ? 'home.featured.badgeToday' : 'home.featured.badgeNext')}</p>
          <h2 id="featured-event-title">{featured.title}</h2>
          <dl className="home-event-meta">
            <div><dt className="sr-only">{t('eventDetail.date')}</dt><dd><time dateTime={hasExplicitTime(featured.start_at) ? featured.start_at : madridDayKey(new Date(featured.start_at))}>{date} · {time}</time></dd></div>
            {featured.venue_name && <div><dt className="sr-only">{t('eventDetail.place')}</dt><dd>{featured.venue_name}</dd></div>}
            <div><dt className="sr-only">{t('eventDetail.price')}</dt><dd className="home-price" data-free={featured.is_free}>
              {featured.is_free ? t('home.featured.free') : featured.price_info || t('home.featured.priceUnknown')}
            </dd></div>
          </dl>
          <span className="home-featured-action">{t('home.featured.cta')}<ArrowRight size={18} className="home-arrow" aria-hidden /></span>
        </div>
      </Link>
    </section>
  );
}
