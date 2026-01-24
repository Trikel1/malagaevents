import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import type { Venue } from '@/types';

interface VenueFilterProps {
  selectedVenueIds: string[];
  onSelectionChange: (venueIds: string[]) => void;
}

const VenueFilter = ({ selectedVenueIds, onSelectionChange }: VenueFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: venues = [], isLoading } = useVenues();

  const filteredVenues = useMemo(() => {
    if (!searchQuery) return venues;
    const query = searchQuery.toLowerCase();
    return venues.filter(v => v.name.toLowerCase().includes(query));
  }, [venues, searchQuery]);

  const selectedVenues = useMemo(() => {
    return venues.filter(v => selectedVenueIds.includes(v.id));
  }, [venues, selectedVenueIds]);

  const toggleVenue = (venueId: string) => {
    if (selectedVenueIds.includes(venueId)) {
      onSelectionChange(selectedVenueIds.filter(id => id !== venueId));
    } else {
      onSelectionChange([...selectedVenueIds, venueId]);
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "gap-2",
              selectedVenueIds.length > 0 && "border-primary"
            )}
          >
            <Building2 className="h-4 w-4" />
            {t('events.venues', 'Salas')}
            {selectedVenueIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {selectedVenueIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', 'Buscar...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <ScrollArea className="h-64">
            <div className="p-2">
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t('common.loading', 'Cargando...')}
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t('common.noResults', 'Sin resultados')}
                </div>
              ) : (
                filteredVenues.map((venue) => (
                  <div
                    key={venue.id}
                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => toggleVenue(venue.id)}
                  >
                    <Checkbox
                      checked={selectedVenueIds.includes(venue.id)}
                      onCheckedChange={() => toggleVenue(venue.id)}
                    />
                    <span className="flex-1 text-sm">{venue.name}</span>
                    {venue.city && (
                      <span className="text-xs text-muted-foreground">{venue.city}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {selectedVenueIds.length > 0 && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={clearSelection}
              >
                <X className="h-4 w-4 mr-2" />
                {t('common.clear', 'Limpiar')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected venue chips */}
      {selectedVenues.map((venue) => (
        <Badge
          key={venue.id}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {venue.name}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => toggleVenue(venue.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
};

export default VenueFilter;
