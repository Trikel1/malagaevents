import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/common/EmptyState';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import type { Event } from '@/types';

interface EventRailProps {
  title: string;
  events: Event[] | undefined;
  isLoading: boolean;
  viewAllTo: string;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  priorityFirst?: boolean;
}

const EventRail = ({
  title,
  events,
  isLoading,
  viewAllTo,
  isFavorite,
  onToggleFavorite,
  priorityFirst,
}: EventRailProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section>
      <div className="flex justify-between items-center mb-3 px-1">
        <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-tight">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary gap-1 min-h-[44px]"
          onClick={() => navigate(viewAllTo)}
        >
          {t('home.sections.viewAll')} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <EventCardSkeleton key={i} />)}
        </div>
      ) : events && events.length > 0 ? (
        <>
          {/* Mobile: horizontal scroll-snap rail */}
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto liquid-scroll [scroll-snap-type:x_mandatory] [scroll-padding-left:1rem]">
            <ul className="flex gap-3 pb-1 w-max">
              {events.map((event, idx) => (
                <li
                  key={event.id}
                  className="w-[72vw] max-w-[300px] shrink-0 [scroll-snap-align:start]"
                >
                  <EventCard
                    event={event}
                    variant="home"
                    priority={priorityFirst && idx === 0}
                    isFavorite={isFavorite(event.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop: 3-column grid */}
          <div className="hidden lg:grid grid-cols-3 gap-6">
            {events.slice(0, 6).map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                variant="home"
                priority={priorityFirst && idx === 0}
                isFavorite={isFavorite(event.id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Calendar}
          title={t('events.noEvents')}
          description={t('events.noEventsDesc')}
        />
      )}
    </section>
  );
};

export default EventRail;
