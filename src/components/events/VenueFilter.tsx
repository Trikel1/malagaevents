import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Search } from 'lucide-react';
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
  const [draftIds, setDraftIds] = useState<string[]>(selectedVenueIds);
  
  const { data: venues = [], isLoading } = useVenues();

  // Sync draft when popover opens
  useEffect(() => {
    if (open) {
      setDraftIds(selectedVenueIds);
      setSearchQuery('');
    }
  }, [open, selectedVenueIds]);

  const filteredVenues = useMemo(() => {
    if (!searchQuery) return venues;
    const query = searchQuery.toLowerCase();
    return venues.filter(v => v.name.toLowerCase().includes(query));
  }, [venues, searchQuery]);

  const selectedVenues = useMemo(() => {
    return venues.filter(v => selectedVenueIds.includes(v.id));
  }, [venues, selectedVenueIds]);

  const toggleDraftVenue = (venueId: string) => {
    setDraftIds(prev =>
      prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
    );
  };

  const handleApply = () => {
    onSelectionChange(draftIds);
    setOpen(false);
  };

  const handleClear = () => {
    onSelectionChange([]);
    setDraftIds([]);
    setOpen(false);
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
          {/* Header: search + actions */}
          <div className="p-2 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search', 'Buscar...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" className="h-8 px-3 text-xs" onClick={handleApply}>
              {t('common.show', 'Mostrar')}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={handleClear}>
              {t('common.clear', 'Limpiar')}
            </Button>
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
                    onClick={() => toggleDraftVenue(venue.id)}
                  >
                    <Checkbox
                      checked={draftIds.includes(venue.id)}
                      onCheckedChange={() => toggleDraftVenue(venue.id)}
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
            onClick={() => onSelectionChange(selectedVenueIds.filter(id => id !== venue.id))}
          >
            <span className="sr-only">Remove</span>
            ×
          </Button>
        </Badge>
      ))}
    </div>
  );
};

export default VenueFilter;
