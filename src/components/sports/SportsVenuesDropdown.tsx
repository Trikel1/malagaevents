import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, Search, Loader2 } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useSportsVenues } from '@/hooks/useSportsEvents';

interface SportsVenuesDropdownProps {
  selectedVenueNames: string[];
  onSelectionChange: (names: string[]) => void;
}

export function SportsVenuesDropdown({
  selectedVenueNames,
  onSelectionChange,
}: SportsVenuesDropdownProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { data: venues = [], isLoading, isError } = useSportsVenues();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAllSelected = selectedVenueNames.length === 0;

  const filteredVenues = searchQuery
    ? venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.city.toLowerCase().includes(searchQuery.toLowerCase()))
    : venues;

  const handleToggleVenue = useCallback((venueName: string) => {
    const isSelected = selectedVenueNames.includes(venueName);
    if (isSelected) {
      const newNames = selectedVenueNames.filter(n => n !== venueName);
      onSelectionChange(newNames);
    } else {
      onSelectionChange([...selectedVenueNames, venueName]);
    }
  }, [selectedVenueNames, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    onSelectionChange([]);
    setOpen(false);
  }, [onSelectionChange]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) setSearchQuery('');
  }, []);

  const selectedCount = selectedVenueNames.length;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={isAllSelected ? 'outline' : 'default'}
          className={cn(
            'h-8 text-xs gap-1.5 px-3',
            !isAllSelected && 'shadow-sm'
          )}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t('sports.venuesTitle', 'Recintos')}</span>
          {selectedCount > 0 && (
            <span className="text-xs opacity-80">({selectedCount})</span>
          )}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(320px,calc(100vw-32px))] p-0 bg-popover border shadow-lg z-50"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
        sticky="always"
        onOpenAutoFocus={(e) => { if (isMobile) e.preventDefault(); }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="max-h-[60vh]">
          {/* Manual search input without autofocus */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder={t('sports.searchVenues', 'Buscar recintos...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList
            className={cn(
              "max-h-[50vh] overflow-y-auto",
              "[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
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
                {t('sports.noVenues', 'No se encontraron recintos')}
              </CommandEmpty>
            ) : (
              <CommandGroup className="p-1">
                {/* "All venues" option */}
                {!searchQuery && (
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer font-medium border-b mb-1"
                  >
                    <Checkbox
                      checked={isAllSelected}
                      className="h-4 w-4"
                    />
                    <span className="flex-1">{t('sports.allVenues', 'Todos los recintos')}</span>
                    <span className="text-xs text-muted-foreground">
                      ({venues.length})
                    </span>
                  </CommandItem>
                )}

                {/* Individual venues */}
                {filteredVenues.map((venue) => {
                  const isSelected = selectedVenueNames.includes(venue.name);
                  return (
                    <CommandItem
                      key={venue.id}
                      value={venue.name}
                      onSelect={() => handleToggleVenue(venue.name)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{venue.name}</span>
                        <span className="text-xs text-muted-foreground block truncate">
                          {venue.city}
                        </span>
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
}

export default SportsVenuesDropdown;
