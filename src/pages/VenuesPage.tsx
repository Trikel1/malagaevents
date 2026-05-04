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
    <div className="min-h-screen bg-background">
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
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              selectedSport === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted'
            )}
          >
            🏅 {t('sports.all')}
          </button>
          {SPORT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedSport(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                selectedSport === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {SPORT_ICONS[cat]} {t(`sports.${cat}`)}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('sports.noVenues')}</p>
          </div>
        ) : (
          filtered.map((venue) => (
            <Card key={venue.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10 shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm break-words">{venue.name}</h3>
                  <p className="text-xs text-muted-foreground">{venue.city}{venue.address ? ` · ${venue.address}` : ''}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {venue.sports.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                        {SPORT_ICONS[s]} {t(`sports.${s}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs"
                  onClick={() => openMap(venue)}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  {t('sports.map')}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default VenuesPage;
