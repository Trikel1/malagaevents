import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [draftNames, setDraftNames] = useState<string[]>(selectedVenueNames);

  // Sync draft when popover opens
  useEffect(() => {
    if (open) {
      setDraftNames(selectedVenueNames);
      setSearchQuery('');
    }
  }, [open, selectedVenueNames]);

  const filteredVenues = searchQuery
    ? venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.city.toLowerCase().includes(searchQuery.toLowerCase()))
    : venues;

  const toggleDraftVenue = useCallback((venueName: string) => {
    setDraftNames(prev =>
      prev.includes(venueName) ? prev.filter(n => n !== venueName) : [...prev, venueName]
    );
  }, []);

  const handleApply = useCallback(() => {
    onSelectionChange(draftNames);
    setOpen(false);
  }, [draftNames, onSelectionChange]);

  const handleClear = useCallback(() => {
    onSelectionChange([]);
    setDraftNames([]);
    setOpen(false);
  }, [onSelectionChange]);

  const selectedCount = selectedVenueNames.length;
  const isAllSelected = selectedCount === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        {/* Header: search + actions */}
        <div className="p-2 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('sports.searchVenues', 'Buscar recintos...')}
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

        <ScrollArea className={cn(
          "max-h-[50vh]",
          "[&::-webkit-scrollbar]:w-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "overscroll-contain",
          "[-webkit-overflow-scrolling:touch]"
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
                {t('sports.noVenues', 'No se encontraron recintos')}
              </div>
            ) : (
              filteredVenues.map((venue) => {
                const isSelected = draftNames.includes(venue.name);
                return (
                  <div
                    key={venue.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => toggleDraftVenue(venue.name)}
                  >
                    <Checkbox checked={isSelected} className="h-4 w-4" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{venue.name}</span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {venue.city}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default SportsVenuesDropdown;
