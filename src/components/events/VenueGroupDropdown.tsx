import { useState, useMemo, useCallback, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Building2, Theater, Loader2, LayoutGrid, Search } from 'lucide-react';
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
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Venue } from '@/types';

export type VenueGroup = 'all' | 'theaters' | 'halls';

interface VenueGroupDropdownProps {
  selectedGroup: VenueGroup;
  selectedVenueIds: string[];
  onGroupChange: (group: VenueGroup) => void;
  onVenueIdsChange: (venueIds: string[]) => void;
}

// Extended Venue type with new DB columns
interface VenueWithType extends Venue {
  venue_type?: 'theater' | 'hall';
  is_featured?: boolean;
}

// CANONICAL THEATERS - exact list as specified
const CANONICAL_THEATER_NAMES = [
  'teatro del soho',
  'auditorio municipal de málaga',
  'auditorio municipal de malaga',
  'teatro cánovas',
  'teatro canovas',
  'centro de arte y creación joven',
  'centro de arte y creacion joven',
  'teatro cervantes',
  'teatro echegaray',
  'auditorio edgar neville',
  'auditorio eduardo ocón',
  'auditorio eduardo ocon',
  'escuela superior de arte dramático',
  'escuela superior de arte dramatico',
  'sala maría cristina',
  'sala maria cristina',
  'teatro romano de málaga',
  'teatro romano de malaga',
];

function classifyVenue(venue: VenueWithType): VenueGroup {
  // First check the DB venue_type if available
  if (venue.venue_type === 'theater') {
    return 'theaters';
  }
  
  const name = venue.name?.toLowerCase() || '';
  const normalizedName = venue.normalized_name?.toLowerCase() || '';
  
  // Check against canonical theater names
  for (const pattern of CANONICAL_THEATER_NAMES) {
    if (name.includes(pattern) || normalizedName.includes(pattern.replace(/\s+/g, '-'))) {
      return 'theaters';
    }
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
  const isMobile = useIsMobile();
  const [hallsOpen, setHallsOpen] = useState(false);
  const [theatersOpen, setTheatersOpen] = useState(false);
  const [hallsSearchQuery, setHallsSearchQuery] = useState('');
  const [theatersSearchQuery, setTheatersSearchQuery] = useState('');


  // Classify and filter venues into groups
  const venuesByGroup = useMemo(() => {
    const grouped: Record<VenueGroup, VenueWithType[]> = {
      all: [],
      theaters: [],
      halls: [],
    };

    (venues as VenueWithType[])
      .filter(v => v.name && !v.name.toLowerCase().includes('sin sala'))
      .forEach((venue) => {
        const group = classifyVenue(venue);
        
        if (group === 'theaters') {
          // Only add theaters that match our canonical list
          grouped.theaters.push(venue);
        } else {
          // For halls, only show featured ones (main venues in Málaga city)
          if (venue.is_featured) {
            grouped.halls.push(venue);
          }
        }
        
        // All always includes both featured halls and theaters
        if (group === 'theaters' || venue.is_featured) {
          grouped.all.push(venue);
        }
      });

    // Sort alphabetically
    grouped.theaters.sort((a, b) => a.name.localeCompare(b.name));
    grouped.halls.sort((a, b) => a.name.localeCompare(b.name));

    return grouped;
  }, [venues]);

  // Handle "Todos" button - STOP PROPAGATION to prevent Buscar activation
  const handleSelectAll = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onGroupChange('all');
    onVenueIdsChange([]);
    setHallsOpen(false);
    setTheatersOpen(false);
  }, [onGroupChange, onVenueIdsChange]);

  // Toggle individual venue in multi-select
  const handleToggleVenue = useCallback((venue: Venue, group: VenueGroup) => {
    const isSelected = selectedVenueIds.includes(venue.id);
    let newIds: string[];
    
    if (isSelected) {
      newIds = selectedVenueIds.filter(id => id !== venue.id);
    } else {
      // When adding from a group, ensure we're in that group's context
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
  }, [selectedVenueIds, venuesByGroup, onGroupChange, onVenueIdsChange]);

  // Toggle "all" within a group
  const handleToggleAllInGroup = useCallback((group: VenueGroup, allSelected: boolean) => {
    if (allSelected) {
      onGroupChange('all');
      onVenueIdsChange([]);
    } else {
      const groupVenueIds = venuesByGroup[group].map(v => v.id);
      onGroupChange(group);
      onVenueIdsChange(groupVenueIds);
    }
    
    if (group === 'halls') setHallsOpen(false);
    if (group === 'theaters') setTheatersOpen(false);
  }, [venuesByGroup, onGroupChange, onVenueIdsChange]);

  // Check if all venues in a group are selected
  const isGroupFullySelected = useCallback((group: VenueGroup): boolean => {
    if (selectedGroup !== group) return false;
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    return groupVenueIds.length > 0 && groupVenueIds.every(id => selectedVenueIds.includes(id));
  }, [selectedGroup, venuesByGroup, selectedVenueIds]);

  // Get selected count for display
  const getSelectedCount = useCallback((group: VenueGroup): number => {
    if (selectedGroup !== group) return 0;
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    return selectedVenueIds.filter(id => groupVenueIds.includes(id)).length;
  }, [selectedGroup, venuesByGroup, selectedVenueIds]);

  // Handle popover open change with propagation stop and search reset
  const handleHallsOpenChange = useCallback((open: boolean) => {
    setHallsOpen(open);
    if (open) {
      setTheatersOpen(false);
    } else {
      setHallsSearchQuery('');
    }
  }, []);

  const handleTheatersOpenChange = useCallback((open: boolean) => {
    setTheatersOpen(open);
    if (open) {
      setHallsOpen(false);
    } else {
      setTheatersSearchQuery('');
    }
  }, []);

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
    
    // Get search query for this group
    const searchQuery = isHalls ? hallsSearchQuery : theatersSearchQuery;
    const setSearchQuery = isHalls ? setHallsSearchQuery : setTheatersSearchQuery;
    
    // Filter venues based on search query
    const filteredVenues = searchQuery
      ? groupVenues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : groupVenues;

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'flex-1 h-10 text-sm gap-1.5 justify-center',
              isActive && 'shadow-sm'
            )}
            // CRITICAL: Stop propagation to prevent Buscar from activating
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
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
          className="w-[min(320px,calc(100vw-32px))] p-0 bg-popover border shadow-lg z-50"
          align="center"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions={true}
          sticky="always"
          // Prevent auto-focus on mobile to avoid keyboard popup
          onOpenAutoFocus={(e) => { if (isMobile) e.preventDefault(); }}
          // Stop propagation on content interactions
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Command shouldFilter={false} className="max-h-[60vh]">
            {/* Manual search input without autofocus */}
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder={t('common.search', 'Buscar...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                // NO autoFocus - user must tap to activate keyboard
              />
            </div>
            <CommandList 
              className={cn(
                "max-h-[50vh] overflow-y-auto",
                "[&::-webkit-scrollbar]:w-2",
                "[&::-webkit-scrollbar-track]:bg-transparent",
                "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
                "[&::-webkit-scrollbar-thumb]:rounded-full",
                // iOS scroll bounce and momentum
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
              ) : filteredVenues.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-muted-foreground">
                  {t('events.noVenuesFound', 'No se encontraron venues')}
                </CommandEmpty>
              ) : (
                <CommandGroup className="p-1">
                  {/* "All" option with checkbox - only show when not searching */}
                  {!searchQuery && (
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
                  )}
                  
                  {/* Individual venues with checkboxes */}
                  {filteredVenues.map((venue) => {
                    const isSelected = selectedVenueIds.includes(venue.id);
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
    <div 
      className="flex gap-2 w-full"
      // Prevent any click from bubbling up to parent (e.g., Buscar handler)
      onClick={(e) => e.stopPropagation()}
    >
      {/* Todos Button */}
      <Button
        variant={selectedGroup === 'all' ? 'default' : 'outline'}
        onClick={handleSelectAll}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'flex-1 h-10 text-sm gap-1.5 justify-center',
          selectedGroup === 'all' && 'shadow-sm'
        )}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span>{t('events.allVenues', 'Todos')}</span>
      </Button>

      {/* Salas Dropdown */}
      {renderGroupDropdown('halls', hallsOpen, handleHallsOpenChange)}

      {/* Teatros Dropdown */}
      {renderGroupDropdown('theaters', theatersOpen, handleTheatersOpenChange)}
    </div>
  );
}

export default VenueGroupDropdown;
