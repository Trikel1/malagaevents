import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Building2, Theater } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import type { Venue } from '@/types';

export type VenueGroup = 'all' | 'theaters' | 'halls' | 'others';

interface VenueGroupDropdownProps {
  selectedGroup: VenueGroup;
  selectedVenueIds: string[];
  onGroupChange: (group: VenueGroup) => void;
  onVenueIdsChange: (venueIds: string[]) => void;
}

// Venue classification by normalized name patterns
const THEATER_PATTERNS = [
  'teatro del soho',
  'teatro cervantes',
  'teatro echegaray',
  'factoria echegaray',
  'factoría echegaray',
  'la cochera cabaret',
  'cochera cabaret',
];

const HALL_PATTERNS = [
  'paris 15',
  'parís 15',
  'sala trinchera',
  'sala marte',
  'eventual',
  'antojo',
];

function classifyVenue(venue: Venue): VenueGroup {
  const name = venue.normalized_name?.toLowerCase() || venue.name?.toLowerCase() || '';
  
  if (THEATER_PATTERNS.some(pattern => name.includes(pattern))) {
    return 'theaters';
  }
  
  if (HALL_PATTERNS.some(pattern => name.includes(pattern))) {
    return 'halls';
  }
  
  return 'others';
}

export function VenueGroupDropdown({
  selectedGroup,
  selectedVenueIds,
  onGroupChange,
  onVenueIdsChange,
}: VenueGroupDropdownProps) {
  const { t } = useTranslation();
  const { data: venues = [] } = useVenues();
  const [theatersOpen, setTheatersOpen] = useState(false);
  const [hallsOpen, setHallsOpen] = useState(false);

  // Classify all venues into groups
  const venuesByGroup = useMemo(() => {
    const grouped: Record<VenueGroup, Venue[]> = {
      all: [],
      theaters: [],
      halls: [],
      others: [],
    };

    venues.forEach((venue) => {
      const group = classifyVenue(venue);
      grouped[group].push(venue);
      grouped.all.push(venue);
    });

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

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
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
        {t('events.allVenues')}
      </Button>

      {/* Theaters Dropdown */}
      <Popover open={theatersOpen} onOpenChange={setTheatersOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedGroup === 'theaters' ? 'default' : 'outline'}
            size="sm"
            role="combobox"
            aria-expanded={theatersOpen}
            className={cn(
              'shrink-0 text-xs h-8 px-3 gap-1',
              selectedGroup === 'theaters' && 'shadow-sm'
            )}
          >
            <Theater className="h-3.5 w-3.5" />
            {t('events.theaters')}
            {theatersLabel && (
              <span className="ml-1 text-[10px] opacity-80">({theatersLabel})</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('common.search')} className="h-9" />
            <CommandList>
              <CommandEmpty>{t('events.noVenuesFound', 'No se encontraron salas')}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelectAllFromGroup('theaters')}
                  className="font-medium"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedGroup === 'theaters' && 
                      venuesByGroup.theaters.every(v => selectedVenueIds.includes(v.id))
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {t('events.allTheaters', 'Todos los teatros')}
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({venuesByGroup.theaters.length})
                  </span>
                </CommandItem>
                {venuesByGroup.theaters.map((venue) => (
                  <CommandItem
                    key={venue.id}
                    onSelect={() => handleSelectVenue(venue, 'theaters')}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedVenueIds.includes(venue.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {venue.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Halls (Salas) Dropdown */}
      <Popover open={hallsOpen} onOpenChange={setHallsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={selectedGroup === 'halls' ? 'default' : 'outline'}
            size="sm"
            role="combobox"
            aria-expanded={hallsOpen}
            className={cn(
              'shrink-0 text-xs h-8 px-3 gap-1',
              selectedGroup === 'halls' && 'shadow-sm'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            {t('events.halls')}
            {hallsLabel && (
              <span className="ml-1 text-[10px] opacity-80">({hallsLabel})</span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('common.search')} className="h-9" />
            <CommandList>
              <CommandEmpty>{t('events.noVenuesFound', 'No se encontraron salas')}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelectAllFromGroup('halls')}
                  className="font-medium"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedGroup === 'halls' && 
                      venuesByGroup.halls.every(v => selectedVenueIds.includes(v.id))
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {t('events.allHalls', 'Todas las salas')}
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({venuesByGroup.halls.length})
                  </span>
                </CommandItem>
                {venuesByGroup.halls.map((venue) => (
                  <CommandItem
                    key={venue.id}
                    onSelect={() => handleSelectVenue(venue, 'halls')}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedVenueIds.includes(venue.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {venue.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Others count badge */}
      {venuesByGroup.others.length > 0 && (
        <Button
          variant={selectedGroup === 'others' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            const otherIds = venuesByGroup.others.map(v => v.id);
            onGroupChange('others');
            onVenueIdsChange(otherIds);
          }}
          className={cn(
            'shrink-0 text-xs h-8 px-3',
            selectedGroup === 'others' && 'shadow-sm'
          )}
        >
          {t('events.otherVenues')}
          <span className="ml-1.5 text-[10px] opacity-80">
            ({venuesByGroup.others.length})
          </span>
        </Button>
      )}
    </div>
  );
}
