import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CalendarDays, MapPin, Ticket, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import HomeEventCard from './HomeEventCard';
import { EventCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { useAuthContext } from '@/contexts/AuthContext';
import InterestPicker from '@/modules/interests/InterestPicker';
import { useInterests } from '@/modules/interests/useInterests';
import { useRecommendations } from '@/modules/interests/useRecommendations';
import { getInterest } from '@/modules/interests/catalog';
import type { SportsEntity } from '@/types/sportsEntities';

const SportsRecommendationCard = ({ entity }: { entity: SportsEntity }) => {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const date = entity.date_start
    ? new Date(`${entity.date_start}T12:00:00Z`).toLocaleDateString(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Madrid',
      })
    : null;

  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        {t('home.forYou.sportsBadge')}
      </span>
      <h3 className="text-sm font-semibold leading-tight">{entity.name}</h3>
      <div className="space-y-1 text-[12.5px] text-muted-foreground">
        {date && (
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="capitalize">
              {date}
              {entity.time_start ? ` · ${entity.time_start.slice(0, 5)}` : ''}
            </span>
          </p>
        )}
        {(entity.address || entity.district || entity.city) && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {[entity.address, entity.district, entity.city].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {entity.price
              ? entity.price
              : entity.registration_url
              ? t('sportsAgenda.registrationRequired', 'Requiere inscripción previa')
              : t('sportsAgenda.ticketsUnknown', 'Información de entradas no disponible')}
          </span>
        </p>
      </div>

      {(entity.organizer || entity.notes || entity.age_group) && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1 inline-flex w-fit items-center gap-1 min-h-11 text-[12.5px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            {expanded ? t('home.forYou.lessInfo') : t('home.forYou.moreInfo')}
          </button>
          {expanded && (
            <div className="text-[12.5px] text-muted-foreground space-y-1">
              {entity.organizer && <p>{entity.organizer}</p>}
              {entity.age_group && <p>{entity.age_group}</p>}
              {entity.notes && <p>{entity.notes}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ForYouSection = ({ excludedEventId }: { excludedEventId?: string | null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const {
    interests,
    isGuest,
    isLoading: interestsLoading,
    pendingImport,
    acceptImport,
    dismissImport,
    status,
    remoteFailed,
    storageBlocked,
    importConflict,
  } = useInterests();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { recommendations, isStarter, isLoading, isError } = useRecommendations(interests, 6);
  const visibleRecommendations = recommendations.filter(rec => rec.kind !== 'culture' || rec.event.id !== excludedEventId);

  const { data: favorites } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const isFavorite = (eventId: string) => favorites?.some((f) => f.event_id === eventId) ?? false;
  const handleToggleFavorite = (eventId: string) => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    toggleFavorite.mutate({ eventId, isFavorite: isFavorite(eventId) });
  };

  const reason = (interestId: string | null) => {
    if (!interestId) return null;
    const def = getInterest(interestId);
    if (!def) return null;
    return t('home.forYou.reason', { interest: t(`interests.items.${def.labelKey}`) });
  };

  return (
    <section aria-labelledby="for-you-title" className="home-personalization">
      <div className="home-section-header">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h2 id="for-you-title" className="home-section-title">
              {t('home.forYou.title')}
            </h2>
          </div>

        </div>
        <Button
          variant="ghost"
          size="sm"
          className="home-section-action gap-1.5"
          onClick={() => setPickerOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {interests.length > 0 ? t('home.forYou.editInterests') : t('home.forYou.chooseInterests')}
        </Button>
      </div>

      {pendingImport && (
        <div className="glass-card p-4 mb-3" role="region" aria-label={t('home.forYou.importTitle')}>
          <p className="text-sm font-medium">{t('home.forYou.importTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('home.forYou.importHelp')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button className="h-11 px-4" onClick={() => void acceptImport()}>
              {t('home.forYou.importAccept')}
            </Button>
            <Button variant="outline" className="h-11 px-4" onClick={dismissImport}>
              {t('home.forYou.importDismiss')}
            </Button>
          </div>
        </div>
      )}

      {interestsLoading || isLoading ? (
        <div className="home-collection home-collection-personalized">
          {[1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="glass-card p-5">
          <p className="text-sm font-medium">{t('home.forYou.errorTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('home.forYou.errorHelp')}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass-card p-5">
          <p className="text-sm font-medium">{t('home.forYou.noMatchTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('home.forYou.noMatchHelp')}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="outline" className="h-11 px-5" onClick={() => navigate('/events')}>
              {t('home.forYou.browseAll')}
            </Button>

          </div>
        </div>
      ) : (
        <>
          {isStarter && (
            <p className="home-note">
              {t(
                'home.forYou.starterNote',
                'Selección variada de los próximos planes. Elige tus gustos y la ajustamos a ti.',
              )}
            </p>
          )}
          <div className="home-collection home-collection-personalized">
            {visibleRecommendations.map((rec) => (
              <div key={rec.id} className="flex flex-col gap-1.5">
                {rec.kind === 'culture' ? (
                  <HomeEventCard
                    event={rec.event}
                    isFavorite={isFavorite(rec.event.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ) : (
                  <SportsRecommendationCard entity={rec.entity} />
                )}
                {reason(rec.reasonInterestId) && (
                  <p className="home-reason">{reason(rec.reasonInterestId)}</p>
                )}
              </div>
            ))}
          </div>
          {visibleRecommendations.length === 0 && <p className="home-note">{t('home.pilot.alreadyShown')}</p>}
        </>
      )}

      {importConflict && (
        <p className="mt-2 text-[11.5px] text-muted-foreground" role="status">
          {t('interests.importConflict')}
        </p>
      )}

      {(() => {
        const failed = isGuest ? storageBlocked : remoteFailed || status === 'error';
        if (!failed && interests.length === 0) return null;
        return (
          <p
            className={`mt-2 text-[11.5px] ${failed ? 'text-destructive' : 'text-muted-foreground'}`}
            role={failed ? 'alert' : undefined}
          >
            {failed
              ? isGuest
                ? t('interests.deviceBlocked')
                : t('interests.syncFailed')
              : isGuest
              ? t('interests.savedOnDevice')
              : t('interests.syncedWithAccount')}
          </p>
        );
      })()}

      <InterestPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </section>
  );
};

export default ForYouSection;
