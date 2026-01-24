import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, MapPin, Search } from 'lucide-react';
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
import { useLocations } from '@/hooks/useLocations';
import type { Location } from '@/types';

interface LocationFilterProps {
  selectedLocationIds: string[];
  onSelectionChange: (locationIds: string[]) => void;
}

const LocationFilter = ({ selectedLocationIds, onSelectionChange }: LocationFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: locations = [], isLoading } = useLocations();

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    const query = searchQuery.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(query));
  }, [locations, searchQuery]);

  const selectedLocations = useMemo(() => {
    return locations.filter(l => selectedLocationIds.includes(l.id));
  }, [locations, selectedLocationIds]);

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "gap-2",
              selectedLocationIds.length > 0 && "border-primary"
            )}
          >
            <MapPin className="h-4 w-4" />
            {t('events.locations', 'Localidad')}
            {selectedLocationIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {selectedLocationIds.length}
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

      {/* Selected location chips */}
      {selectedLocations.map((location) => (
        <Badge
          key={location.id}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {location.name}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => toggleLocation(location.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
};

export default LocationFilter;
