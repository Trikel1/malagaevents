import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Building2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSportsVenues } from '@/hooks/useSportsEvents';
import { SPORT_CATEGORIES, type SportCategory } from '@/types/sports';
import SportIcon from '@/components/sports/SportIcon';
import { Trophy } from 'lucide-react';
import SEO from '@/components/common/SEO';
import PageHero from '@/components/common/PageHero';
import { getSportLabel } from '@/lib/sports';

const VenuesPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<SportCategory | 'all'>('all');
  const { data: venues = [], isLoading } = useSportsVenues();

  const filtered = useMemo(() => {
    let result = venues;
    if (selectedSport !== 'all') {
      result = result.filter(v => v.sports.includes(selectedSport));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
    }
    return result;
  }, [search, selectedSport, venues]);

  const openMap = (venue: typeof venues[0]) => {
    if (venue.lat && venue.lng) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS
        ? `maps://maps.apple.com/?daddr=${venue.lat},${venue.lng}`
        : `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
      window.open(url, '_blank');
    } else if (venue.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name + ' ' + venue.city)}`, '_blank');
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <SEO
        title={t('seo.venues.title')}
        description={t('seo.venues.description')}
        path="/venues"
        jsonLd={filtered.length > 0 ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Recintos deportivos de Málaga",
          itemListElement: filtered.slice(0, 30).map((v, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "SportsActivityLocation",
              name: v.name,
              address: {
                "@type": "PostalAddress",
                addressLocality: v.city,
                streetAddress: v.address ?? undefined,
                addressRegion: "Málaga",
                addressCountry: "ES",
              },
              ...(v.lat && v.lng ? { geo: { "@type": "GeoCoordinates", latitude: v.lat, longitude: v.lng } } : {}),
            },
          })),
        } : undefined}
      />
      <PageHero
        variant="compact"
        icon={<Building2 className="h-5 w-5" aria-hidden />}
        title={t('sports.venuesTitle')}
        description={t('sports.venuesSubtitle', 'Recintos e instalaciones deportivas de Málaga y su provincia.')}
      >
        <div className="space-y-3">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              placeholder={t('sports.searchVenues')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 rounded-2xl bg-background border-border/70 shadow-sm"
              aria-label={t('sports.searchVenues')}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedSport('all')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                selectedSport === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-pressed={selectedSport === 'all'}
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {t('sports.all', 'Todos')}
            </button>
            {SPORT_CATEGORIES.map((cat) => {
              const active = selectedSport === cat;
              const label = getSportLabel(t, cat);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedSport(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  aria-pressed={active}
                  aria-label={label}
                >
                  <SportIcon sport={cat} className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </PageHero>

      <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground rounded-2xl border border-dashed border-border bg-card/50">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">{t('sports.noVenues', 'No se encontraron recintos')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((venue) => (
              <Card
                key={venue.id}
                className="group h-full rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5"
              >
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-[15px] leading-snug tracking-tight break-words">
                        {venue.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 break-words leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                        {venue.city}{venue.address ? ` · ${venue.address}` : ''}
                      </p>
                    </div>
                  </div>
                  {venue.sports?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {venue.sports.map((s) => (
                        <Badge key={s} variant="outline" className="text-[11px] px-2 py-0.5 gap-1 rounded-full">
                          <SportIcon sport={s} className="h-3 w-3" />
                          {getSportLabel(t, s)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start min-h-[44px] rounded-full mt-auto"
                    onClick={() => openMap(venue)}
                    aria-label={`${t('sports.map', 'Mapa')} — ${venue.name}`}
                  >
                    <MapPin className="h-4 w-4 mr-1.5" aria-hidden />
                    {t('sports.map', 'Mapa')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default VenuesPage;
