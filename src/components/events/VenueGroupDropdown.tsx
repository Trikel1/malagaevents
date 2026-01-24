import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Building2, Theater, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import type { Venue } from '@/types';

export type VenueGroup = 'all' | 'theaters' | 'halls';

interface VenueGroupDropdownProps {
  selectedGroup: VenueGroup;
  selectedVenueIds: string[];
  onGroupChange: (group: VenueGroup) => void;
  onVenueIdsChange: (venueIds: string[]) => void;
}

// CANONICAL CLASSIFICATION: Only these 3 are theaters, everything else is "salas"
const THEATER_VENUE_NAMES = [
  'teatro cervantes',
  'teatro echegaray',
  'teatro del soho',
  'teatro soho',
  'soho caixabank',
];

function classifyVenue(venue: Venue): VenueGroup {
  const name = venue.normalized_name?.toLowerCase() || venue.name?.toLowerCase() || '';
  
  // Only the 3 canonical theaters
  if (THEATER_VENUE_NAMES.some(pattern => name.includes(pattern))) {
    return 'theaters';
  }
  
  // Everything else is a "sala" (including Cochera, Trinchera, París 15, etc.)
  return 'halls';
}

export function VenueGroupDropdown({
  selectedGroup,
  selectedVenueIds,
  onGroupChange,
  onVenueIdsChange,
}: VenueGroupDropdownProps) {
  const { t } = useTranslation();
  const { data: venues = [], isLoading, isError } = useVenues();
  const [theatersOpen, setTheatersOpen] = useState(false);
  const [hallsOpen, setHallsOpen] = useState(false);

  // Classify all venues into groups (exclude placeholder venues)
  const venuesByGroup = useMemo(() => {
    const grouped: Record<VenueGroup, Venue[]> = {
      all: [],
      theaters: [],
      halls: [],
    };

    venues
      .filter(v => v.name && !v.name.toLowerCase().includes('sin sala'))
      .forEach((venue) => {
        const group = classifyVenue(venue);
        grouped[group].push(venue);
        grouped.all.push(venue);
      });

    // Sort alphabetically
    grouped.theaters.sort((a, b) => a.name.localeCompare(b.name));
    grouped.halls.sort((a, b) => a.name.localeCompare(b.name));

    return grouped;
  }, [venues]);

  const handleSelectAll = () => {
    onGroupChange('all');
    onVenueIdsChange([]);
    setTheatersOpen(false);
    setHallsOpen(false);
  };

  const handleSelectVenue = (venue: Venue, group: VenueGroup) => {
    const isSelected = selectedVenueIds.includes(venue.id);
    let newIds: string[];
    
    if (isSelected) {
      newIds = selectedVenueIds.filter(id => id !== venue.id);
    } else {
      newIds = [...selectedVenueIds, venue.id];
    }
    
    // If no venues selected, reset to all
    if (newIds.length === 0) {
      onGroupChange('all');
      onVenueIdsChange([]);
    } else {
      onGroupChange(group);
      onVenueIdsChange(newIds);
    }
  };

  const handleSelectAllFromGroup = (group: VenueGroup) => {
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    onGroupChange(group);
    onVenueIdsChange(groupVenueIds);
    if (group === 'theaters') setTheatersOpen(false);
    if (group === 'halls') setHallsOpen(false);
  };

  // Get selected venue names for display
  const getSelectedLabel = (group: VenueGroup): string => {
    if (selectedGroup !== group) return '';
    if (selectedVenueIds.length === 0) return '';
    
    const groupVenues = venuesByGroup[group];
    const allGroupSelected = groupVenues.length > 0 && 
      groupVenues.every(v => selectedVenueIds.includes(v.id));
    
    if (allGroupSelected) {
      return group === 'theaters' ? t('events.allTheaters', 'Todos') : t('events.allHalls', 'Todas');
    }
    
    const selectedInGroup = groupVenues.filter(v => selectedVenueIds.includes(v.id));
    if (selectedInGroup.length === 1) {
      return selectedInGroup[0].name;
    }
    return `${selectedInGroup.length} selec.`;
  };

  const theatersLabel = getSelectedLabel('theaters');
  const hallsLabel = getSelectedLabel('halls');

  const renderVenueList = (group: VenueGroup, isOpen: boolean, setOpen: (v: boolean) => void) => {
    const groupVenues = venuesByGroup[group];
    const label = group === 'theaters' ? t('events.theaters') : t('events.halls');
    const allLabel = group === 'theaters' 
      ? t('events.allTheaters', 'Todos los teatros') 
      : t('events.allHalls', 'Todas las salas');
    const selectedLabel = group === 'theaters' ? theatersLabel : hallsLabel;
    const Icon = group === 'theaters' ? Theater : Building2;

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedGroup === group ? 'default' : 'outline'}
            size="sm"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              'shrink-0 text-xs h-8 px-3 gap-1',
              selectedGroup === group && 'shadow-sm'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {selectedLabel && (
              <span className="ml-1 text-[10px] opacity-80">({selectedLabel})</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('common.search')} className="h-9" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {t('errors.generic', 'Error al cargar')}
                </div>
              ) : groupVenues.length === 0 ? (
                <CommandEmpty>{t('events.noVenuesFound', 'No se encontraron venues')}</CommandEmpty>
              ) : (
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleSelectAllFromGroup(group)}
                    className="font-medium"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedGroup === group && 
                        groupVenues.every(v => selectedVenueIds.includes(v.id))
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {allLabel}
                    <span className="ml-auto text-xs text-muted-foreground">
                      ({groupVenues.length})
                    </span>
                  </CommandItem>
                  <ScrollArea className="max-h-[240px]">
                    {groupVenues.map((venue) => (
                      <CommandItem
                        key={venue.id}
                        onSelect={() => handleSelectVenue(venue, group)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedVenueIds.includes(venue.id) ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div>
                            <span>{venue.name}</span>
                            {venue.city && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {venue.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex gap-1.5 py-1">
      {/* All Button */}
      <Button
        variant={selectedGroup === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={handleSelectAll}
        className={cn(
          'shrink-0 text-xs h-8 px-3',
          selectedGroup === 'all' && 'shadow-sm'
        )}
      >
        {t('events.allVenues', 'Todos')}
      </Button>

      {/* Salas Dropdown */}
      {renderVenueList('halls', hallsOpen, setHallsOpen)}

      {/* Teatros Dropdown */}
      {renderVenueList('theaters', theatersOpen, setTheatersOpen)}
    </div>
  );
}
