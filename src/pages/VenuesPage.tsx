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
      <header className="bg-card border-b border-border sticky top-0 z-40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{t('sports.venuesTitle')}</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('sports.searchVenues')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedSport('all')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              selectedSport === 'all'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-primary/20'
            )}
          >
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {t('sports.all', 'Todos')}
          </button>
          {SPORT_CATEGORIES.map((cat) => {
            const active = selectedSport === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedSport(cat)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                  active
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-primary/20'
                )}
              >
                <SportIcon sport={cat} className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
                {t(`sports.${cat}`, cat)}
              </button>
            );
          })}
        </div>
      </header>

      <main className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('sports.noVenues', 'No se encontraron recintos')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((venue) => (
              <Card key={venue.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-3 flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10 shrink-0 mt-0.5">
                      <Building2 className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm break-words leading-snug">{venue.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words" style={{ overflowWrap: 'anywhere' }}>
                        {venue.city}{venue.address ? ` · ${venue.address}` : ''}
                      </p>
                    </div>
                  </div>
                  {venue.sports?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {venue.sports.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <SportIcon sport={s} className="h-3 w-3" />
                          {t(`sports.${s}`, s)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start text-xs"
                    onClick={() => openMap(venue)}
                    aria-label={`${t('sports.map', 'Mapa')} — ${venue.name}`}
                  >
                    <MapPin className="h-3 w-3 mr-1" aria-hidden />
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
