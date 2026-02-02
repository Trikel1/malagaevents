import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLocations } from '@/hooks/useLocations';

interface LocationFilterProps {
  selectedLocationIds: string[];
  onSelectionChange: (locationIds: string[]) => void;
  variant?: 'button' | 'icon';
  showLabel?: boolean;
}

const LocationFilter = ({ 
  selectedLocationIds, 
  onSelectionChange,
  variant = 'icon',
  showLabel = false,
}: LocationFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: locations = [], isLoading } = useLocations();

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    const query = searchQuery.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(query));
  }, [locations, searchQuery]);

  const toggleLocation = (locationId: string) => {
    if (selectedLocationIds.includes(locationId)) {
      onSelectionChange(selectedLocationIds.filter(id => id !== locationId));
    } else {
      onSelectionChange([...selectedLocationIds, locationId]);
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
    setSearchQuery('');
  };

  const triggerButton = showLabel ? (
    <Button 
      variant={selectedLocationIds.length > 0 ? 'default' : 'ghost'} 
      size="sm"
      className={cn(
        "h-9 px-2.5 gap-1.5 relative whitespace-nowrap",
        selectedLocationIds.length > 0 && "shadow-sm"
      )}
    >
      <MapPin className="h-4 w-4 shrink-0" />
      <span className="text-sm">{t('events.locations', 'Localidades')}</span>
      {selectedLocationIds.length > 0 && (
        <Badge 
          variant="secondary" 
          className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
        >
          {selectedLocationIds.length}
        </Badge>
      )}
    </Button>
  ) : variant === 'icon' ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant={selectedLocationIds.length > 0 ? 'default' : 'ghost'} 
          size="icon"
          className={cn(
            "h-9 w-9 relative",
            selectedLocationIds.length > 0 && "shadow-sm"
          )}
          aria-label={t('events.locations', 'Localidades')}
        >
          <MapPin className="h-4 w-4" />
          {selectedLocationIds.length > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {selectedLocationIds.length}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('events.locations', 'Localidades')}</TooltipContent>
    </Tooltip>
  ) : (
    <Button 
      variant="outline" 
      size="sm"
      className={cn(
        "gap-2 h-8 text-xs",
        selectedLocationIds.length > 0 && "border-primary"
      )}
    >
      <MapPin className="h-4 w-4" />
      <span className="hidden sm:inline">{t('events.locations', 'Localidad')}</span>
      {selectedLocationIds.length > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
          {selectedLocationIds.length}
        </Badge>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0" 
        align="end"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
        avoidCollisions={true}
      >
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
        <ScrollArea className="h-64 overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="p-2 [&_[data-radix-scroll-area-viewport]]:overscroll-contain [&_[data-radix-scroll-area-viewport]]:[-webkit-overflow-scrolling:touch]">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('common.loading', 'Cargando...')}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('common.noResults', 'Sin resultados')}
              </div>
            ) : (
              filteredLocations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => toggleLocation(location.id)}
                >
                  <Checkbox
                    checked={selectedLocationIds.includes(location.id)}
                    onCheckedChange={() => toggleLocation(location.id)}
                  />
                  <span className="flex-1 text-sm">{location.name}</span>
                  {!location.is_in_province_malaga && (
                    <Badge variant="outline" className="text-xs">
                      {location.province}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {selectedLocationIds.length > 0 && (
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
  );
};

export default LocationFilter;
