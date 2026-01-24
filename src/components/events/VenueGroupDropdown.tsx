import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Building2, Theater, Loader2, LayoutGrid } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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

// CANONICAL THEATERS - ONLY these 3 are theaters
const CANONICAL_THEATERS = [
  'teatro-cervantes',
  'teatro-echegaray', 
  'teatro-del-soho-caixabank',
  'teatro-soho',
  'teatro-del-soho',
];

function classifyVenue(venue: Venue): VenueGroup {
  const normalizedName = venue.normalized_name?.toLowerCase() || '';
  const name = venue.name?.toLowerCase() || '';
  
  // Check normalized_name first (more reliable)
  for (const pattern of CANONICAL_THEATERS) {
    if (normalizedName === pattern || normalizedName.includes(pattern)) {
      return 'theaters';
    }
  }
  
  // Also check display name for "Teatro Cervantes", "Teatro Echegaray", "Teatro del Soho"
  if (
    name.includes('teatro cervantes') ||
    name.includes('teatro echegaray') ||
    name.includes('teatro del soho') ||
    name.includes('teatro soho')
  ) {
    return 'theaters';
  }
  
  // Everything else is a "sala"
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
  const [hallsOpen, setHallsOpen] = useState(false);
  const [theatersOpen, setTheatersOpen] = useState(false);

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

  // Handle "Todos" button
  const handleSelectAll = () => {
    onGroupChange('all');
    onVenueIdsChange([]);
    setHallsOpen(false);
    setTheatersOpen(false);
  };

  // Toggle individual venue in multi-select
  const handleToggleVenue = (venue: Venue, group: VenueGroup) => {
    const isSelected = selectedVenueIds.includes(venue.id);
    let newIds: string[];
    
    if (isSelected) {
      newIds = selectedVenueIds.filter(id => id !== venue.id);
    } else {
      // When adding from a group, ensure we're in that group's context
      // and only keep venues from that group
      const groupVenueIds = venuesByGroup[group].map(v => v.id);
      const currentGroupVenues = selectedVenueIds.filter(id => groupVenueIds.includes(id));
      newIds = [...currentGroupVenues, venue.id];
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

  // Toggle "all" within a group
  const handleToggleAllInGroup = (group: VenueGroup, allSelected: boolean) => {
    if (allSelected) {
      // Deselect all -> go back to 'all'
      onGroupChange('all');
      onVenueIdsChange([]);
    } else {
      // Select all in this group
      const groupVenueIds = venuesByGroup[group].map(v => v.id);
      onGroupChange(group);
      onVenueIdsChange(groupVenueIds);
    }
    
    if (group === 'halls') setHallsOpen(false);
    if (group === 'theaters') setTheatersOpen(false);
  };

  // Check if all venues in a group are selected
  const isGroupFullySelected = (group: VenueGroup): boolean => {
    if (selectedGroup !== group) return false;
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    return groupVenueIds.length > 0 && groupVenueIds.every(id => selectedVenueIds.includes(id));
  };

  // Get selected count for display
  const getSelectedCount = (group: VenueGroup): number => {
    if (selectedGroup !== group) return 0;
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    return selectedVenueIds.filter(id => groupVenueIds.includes(id)).length;
  };

  // Render dropdown for a group
  const renderGroupDropdown = (group: VenueGroup, isOpen: boolean, setOpen: (v: boolean) => void) => {
    const groupVenues = venuesByGroup[group];
    const isHalls = group === 'halls';
    const label = isHalls ? t('events.halls', 'Salas') : t('events.theaters', 'Teatros');
    const allLabel = isHalls 
      ? t('events.allHalls', 'Todas las salas') 
      : t('events.allTheaters', 'Todos los teatros');
    const Icon = isHalls ? Building2 : Theater;
    const allSelected = isGroupFullySelected(group);
    const selectedCount = getSelectedCount(group);
    const isActive = selectedGroup === group;

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'flex-1 h-10 text-sm gap-1.5 justify-center',
              isActive && 'shadow-sm'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {selectedCount > 0 && !allSelected && (
              <span className="text-xs opacity-80">({selectedCount})</span>
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[min(320px,calc(100vw-32px))] p-0 bg-popover border shadow-lg"
          align="center"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions={true}
          sticky="always"
        >
          <Command className="max-h-[60vh]">
            <CommandInput 
              placeholder={t('common.search', 'Buscar...')} 
              className="h-10 border-b"
            />
            <CommandList 
              className={cn(
                "max-h-[50vh] overflow-y-auto",
                "[&::-webkit-scrollbar]:w-2",
                "[&::-webkit-scrollbar-track]:bg-transparent",
                "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                // iOS scroll bounce
                "overscroll-contain",
                "[-webkit-overflow-scrolling:touch]"
              )}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {t('errors.generic', 'Error al cargar')}
                </div>
              ) : groupVenues.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-muted-foreground">
                  {t('events.noVenuesFound', 'No se encontraron venues')}
                </CommandEmpty>
              ) : (
                <CommandGroup className="p-1">
                  {/* "All" option with checkbox */}
                  <CommandItem
                    onSelect={() => handleToggleAllInGroup(group, allSelected)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-medium border-b mb-1"
                  >
                    <Checkbox
                      checked={allSelected}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{allLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      ({groupVenues.length})
                    </span>
                  </CommandItem>
                  
                  {/* Individual venues with checkboxes */}
                  {groupVenues.map((venue) => {
                    const isSelected = selectedVenueIds.includes(venue.id);
                    // Only show city if it's NOT Málaga
                    const showCity = venue.city && 
                      !venue.city.toLowerCase().includes('málaga') &&
                      !venue.city.toLowerCase().includes('malaga');
                    
                    return (
                      <CommandItem
                        key={venue.id}
                        value={venue.name}
                        onSelect={() => handleToggleVenue(venue, group)}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={isSelected}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{venue.name}</span>
                          {showCity && (
                            <span className="text-xs text-muted-foreground block truncate">
                              {venue.city}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex gap-2 w-full">
      {/* Todos Button */}
      <Button
        variant={selectedGroup === 'all' ? 'default' : 'outline'}
        onClick={handleSelectAll}
        className={cn(
          'flex-1 h-10 text-sm gap-1.5 justify-center',
          selectedGroup === 'all' && 'shadow-sm'
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span>{t('events.allVenues', 'Todos')}</span>
      </Button>

      {/* Salas Dropdown */}
      {renderGroupDropdown('halls', hallsOpen, setHallsOpen)}

      {/* Teatros Dropdown */}
      {renderGroupDropdown('theaters', theatersOpen, setTheatersOpen)}
    </div>
  );
}

export default VenueGroupDropdown;
