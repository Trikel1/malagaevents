import { useState, useMemo, useCallback, useEffect, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Building2, Theater, Loader2, LayoutGrid, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  if (venue.venue_type === 'theater') return 'theaters';

  const name = venue.name?.toLowerCase() || '';
  const normalizedName = venue.normalized_name?.toLowerCase() || '';

  for (const pattern of CANONICAL_THEATER_NAMES) {
    if (name.includes(pattern) || normalizedName.includes(pattern.replace(/\s+/g, '-'))) {
      return 'theaters';
    }
  }

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
  const [draftIds, setDraftIds] = useState<string[]>(selectedVenueIds);

  // Sync draft when popover opens
  useEffect(() => {
    if (hallsOpen || theatersOpen) {
      setDraftIds(selectedVenueIds);
    }
  }, [hallsOpen, theatersOpen, selectedVenueIds]);

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
          grouped.theaters.push(venue);
        } else if (venue.is_featured) {
          grouped.halls.push(venue);
        }
        if (group === 'theaters' || venue.is_featured) {
          grouped.all.push(venue);
        }
      });

    grouped.theaters.sort((a, b) => a.name.localeCompare(b.name));
    grouped.halls.sort((a, b) => a.name.localeCompare(b.name));
    return grouped;
  }, [venues]);

  // Handle "Todos" button
  const handleSelectAll = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onGroupChange('all');
    onVenueIdsChange([]);
    setDraftIds([]);
    setHallsOpen(false);
    setTheatersOpen(false);
  }, [onGroupChange, onVenueIdsChange]);

  // Draft-only toggle for individual venue
  const handleToggleDraftVenue = useCallback((venueId: string) => {
    setDraftIds(prev =>
      prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]
    );
  }, []);

  // Draft-only toggle all in group
  const handleToggleAllDraftInGroup = useCallback((group: VenueGroup) => {
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    const allInDraft = groupVenueIds.every(id => draftIds.includes(id));
    if (allInDraft) {
      setDraftIds(prev => prev.filter(id => !groupVenueIds.includes(id)));
    } else {
      setDraftIds(prev => [...new Set([...prev, ...groupVenueIds])]);
    }
  }, [venuesByGroup, draftIds]);

  // Apply: draft → active
  const handleApplyGroup = useCallback((group: VenueGroup) => {
    const groupVenueIds = venuesByGroup[group].map(v => v.id);
    const selectedFromGroup = draftIds.filter(id => groupVenueIds.includes(id));
    if (selectedFromGroup.length === 0) {
      onGroupChange('all');
      onVenueIdsChange([]);
    } else {
      onGroupChange(group);
      onVenueIdsChange(selectedFromGroup);
    }
    if (group === 'halls') setHallsOpen(false);
    if (group === 'theaters') setTheatersOpen(false);
  }, [venuesByGroup, draftIds, onGroupChange, onVenueIdsChange]);

  // Clear: reset to show all
  const handleClearGroup = useCallback((group: VenueGroup) => {
    onGroupChange('all');
    onVenueIdsChange([]);
    setDraftIds([]);
    if (group === 'halls') setHallsOpen(false);
    if (group === 'theaters') setTheatersOpen(false);
  }, [onGroupChange, onVenueIdsChange]);

  // Popover open/change handlers with search reset
  const handleHallsOpenChange = useCallback((open: boolean) => {
    setHallsOpen(open);
    if (open) setTheatersOpen(false);
    else setHallsSearchQuery('');
  }, []);

  const handleTheatersOpenChange = useCallback((open: boolean) => {
    setTheatersOpen(open);
    if (open) setHallsOpen(false);
    else setTheatersSearchQuery('');
  }, []);

  // Render dropdown for a group with Mostrar/Limpiar header
  const renderGroupDropdown = (group: VenueGroup, isOpen: boolean, setOpen: (v: boolean) => void) => {
    const groupVenues = venuesByGroup[group];
    const isHalls = group === 'halls';
    const label = isHalls ? t('events.halls', 'Salas') : t('events.theaters', 'Teatros');
    const Icon = isHalls ? Building2 : Theater;
    const isActive = selectedGroup === group;

    const searchQuery = isHalls ? hallsSearchQuery : theatersSearchQuery;
    const setSearchQuery = isHalls ? setHallsSearchQuery : setTheatersSearchQuery;

    const filteredVenues = searchQuery
      ? groupVenues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : groupVenues;

    // Draft-based checks
    const groupVenueIds = groupVenues.map(v => v.id);
    const draftCount = draftIds.filter(id => groupVenueIds.includes(id)).length;
    const allDraftSelected = groupVenueIds.length > 0 && groupVenueIds.every(id => draftIds.includes(id));

    // Active count for button badge
    const activeCount = selectedVenueIds.filter(id => groupVenueIds.includes(id)).length;

    return (
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'flex-1 min-w-0 h-10 text-sm gap-1 sm:gap-1.5 px-2 sm:px-3 justify-center',
              isActive && 'shadow-sm'
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {activeCount > 0 && (
              <span className="text-xs opacity-80">({activeCount})</span>
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
          onOpenAutoFocus={(e) => { if (isMobile) e.preventDefault(); }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header: search + Mostrar + Limpiar */}
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
            <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handleApplyGroup(group)}>
              {t('common.show', 'Mostrar')}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => handleClearGroup(group)}>
              {t('common.clear', 'Limpiar')}
            </Button>
          </div>

          <ScrollArea className={cn(
            "max-h-[50vh]",
            "overscroll-contain [-webkit-overflow-scrolling:touch]"
          )}>
            <div className="p-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {t('errors.generic', 'Error al cargar')}
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t('common.noResults', 'Sin resultados')}
                </div>
              ) : (
                <>
                  {/* "All in group" toggle - only when not searching */}
                  {!searchQuery && (
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent cursor-pointer font-medium border-b mb-1"
                      onClick={() => handleToggleAllDraftInGroup(group)}
                    >
                      <Checkbox checked={allDraftSelected} className="h-4 w-4" />
                      <span className="flex-1">
                        {isHalls ? t('events.allHalls', 'Todas las salas') : t('events.allTheaters', 'Todos los teatros')}
                      </span>
                      <span className="text-xs text-muted-foreground">({groupVenues.length})</span>
                    </div>
                  )}

                  {/* Málaga capital primero, luego resto agrupado por localidad */}
                  {(() => {
                    const isMalagaCity = (c?: string | null) =>
                      !!c && /m[aá]laga/i.test(c);
                    const sorted = [...filteredVenues].sort((a, b) => {
                      const am = isMalagaCity(a.city) ? 0 : 1;
                      const bm = isMalagaCity(b.city) ? 0 : 1;
                      if (am !== bm) return am - bm;
                      const ac = (a.city || 'Otros').localeCompare(b.city || 'Otros');
                      return ac !== 0 ? ac : a.name.localeCompare(b.name);
                    });
                    let lastHeader = '';
                    return sorted.map((venue) => {
                      const header = isMalagaCity(venue.city)
                        ? 'Málaga capital'
                        : (venue.city || 'Otros municipios');
                      const showHeader = header !== lastHeader;
                      lastHeader = header;
                      const isSelected = draftIds.includes(venue.id);
                      const showCity = !isMalagaCity(venue.city) && venue.city;
                      return (
                        <div key={venue.id}>
                          {showHeader && (
                            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                              {header}
                            </div>
                          )}
                          <div
                            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleToggleDraftVenue(venue.id)}
                          >
                            <Checkbox checked={isSelected} className="h-4 w-4" />
                            <div className="flex-1 min-w-0">
                              <span className="block truncate text-sm">{venue.name}</span>
                              {showCity && (
                                <span className="text-xs text-muted-foreground block truncate">
                                  {venue.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div
      className="flex gap-2 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Todos Button */}
      <Button
        variant={selectedGroup === 'all' ? 'default' : 'outline'}
        onClick={handleSelectAll}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'flex-1 min-w-0 h-10 text-sm gap-1 sm:gap-1.5 px-2 sm:px-3 justify-center',
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
