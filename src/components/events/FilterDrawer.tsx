import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarIcon, X, Baby, Users, Heart, Trees, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';



import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import CategoryChip from './CategoryChip';
import { EVENT_CATEGORIES, type EventCategory } from '@/types';

export type DatePreset = 'today' | 'tomorrow' | 'thisWeek' | 'weekend' | 'next30';
export type AgeRange = '0-3' | '4-8' | '9-12';

export interface EventFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categories: EventCategory[];
  isFree?: boolean;
  onlyFavorites?: boolean;
  datePreset?: DatePreset;
  withTickets?: boolean;
  familyKids?: boolean;
  ageRange?: AgeRange;
  isOutdoor?: boolean;
}

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: EventFilters;
  onApplyFilters: (filters: EventFilters) => void;
  showFavoritesFilter?: boolean;
}

const FilterDrawer = ({
  open,
  onOpenChange,
  filters,
  onApplyFilters,
  showFavoritesFilter = false,
}: FilterDrawerProps) => {
  const { t } = useTranslation();
  const [localFilters, setLocalFilters] = useState<EventFilters>(filters);

  const handleCategoryToggle = (category: EventCategory) => {
    setLocalFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleClearFilters = () => {
    setLocalFilters({
      categories: [],
      isFree: undefined,
      onlyFavorites: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      datePreset: undefined,
      withTickets: undefined,
      familyKids: undefined,
      ageRange: undefined,
      isOutdoor: undefined,
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onOpenChange(false);
  };

  // Build the visible summary of active filters as removable chips
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (localFilters.datePreset === 'weekend') {
      chips.push({
        key: 'weekend',
        label: t('common.thisWeekend', 'Este finde'),
        onRemove: () => setLocalFilters((p) => ({ ...p, datePreset: undefined })),
      });
    }
    if (localFilters.familyKids) {
      chips.push({
        key: 'family',
        label: t('events.family', 'Infantil'),
        onRemove: () => setLocalFilters((p) => ({ ...p, familyKids: undefined })),
      });
    }
    if (localFilters.isFree) {
      chips.push({
        key: 'free',
        label: t('common.free', 'Gratis'),
        onRemove: () => setLocalFilters((p) => ({ ...p, isFree: undefined })),
      });
    }
    if (localFilters.isOutdoor) {
      chips.push({
        key: 'outdoor',
        label: t('events.outdoor', 'Al aire libre'),
        onRemove: () => setLocalFilters((p) => ({ ...p, isOutdoor: undefined })),
      });
    }
    if (localFilters.withTickets) {
      chips.push({
        key: 'tickets',
        label: t('events.withTickets', 'Con entradas'),
        onRemove: () => setLocalFilters((p) => ({ ...p, withTickets: undefined })),
      });
    }
    if (localFilters.onlyFavorites) {
      chips.push({
        key: 'favs',
        label: t('events.onlyFavorites', 'Solo favoritos'),
        onRemove: () => setLocalFilters((p) => ({ ...p, onlyFavorites: undefined })),
      });
    }
    if (localFilters.dateFrom) {
      chips.push({
        key: 'from',
        label: `${t('events.dateFrom', 'Desde')} ${format(localFilters.dateFrom, 'd MMM')}`,
        onRemove: () => setLocalFilters((p) => ({ ...p, dateFrom: undefined })),
      });
    }
    if (localFilters.dateTo) {
      chips.push({
        key: 'to',
        label: `${t('events.dateTo', 'Hasta')} ${format(localFilters.dateTo, 'd MMM')}`,
        onRemove: () => setLocalFilters((p) => ({ ...p, dateTo: undefined })),
      });
    }
    for (const cat of localFilters.categories) {
      chips.push({
        key: `cat-${cat}`,
        label: t(`categories.${cat}`, cat),
        onRemove: () =>
          setLocalFilters((p) => ({
            ...p,
            categories: p.categories.filter((c) => c !== cat),
          })),
      });
    }
    return chips;
  }, [localFilters, t]);

  const activeCount = activeChips.length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] h-[90vh] flex flex-col">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle className="flex items-center gap-2">
            {t('events.filters')}
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
                {activeCount}
              </span>
            )}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        {/* Active filters summary — sticky under the header, con botón Mostrar */}
        {activeCount > 0 && (
          <div className="px-4 pb-3 -mt-1 border-b border-border/60 bg-background">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('events.activeFilters', 'Filtros activos')}
              </span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="ml-auto text-[11px] text-primary hover:underline underline-offset-2"
              >
                {t('events.clearAll', 'Quitar todos')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  <span className="truncate max-w-[160px]">{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`${t('common.clearOne', 'Quitar')} ${chip.label}`}
                    className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Button
              onClick={handleApply}
              size="sm"
              className="w-full mt-2.5 font-semibold shadow-sm"
            >
              {`${t('events.showResults', 'Mostrar')} · ${activeCount}`}
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 px-4 pt-4 pb-6 overflow-y-auto space-y-6 [-webkit-overflow-scrolling:touch] overscroll-contain">

          {/* Quick presets — infantil/familiar priorizados arriba */}

          <div className="space-y-2">
            <Label>{t('events.quickPresets', 'Accesos rápidos')}</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'family', label: t('events.family', 'Infantil'), icon: Baby, on: localFilters.familyKids === true, toggle: () => setLocalFilters((p) => ({ ...p, familyKids: p.familyKids ? undefined : true })) },
                { key: 'free', label: t('common.free', 'Gratis'), icon: Heart, on: localFilters.isFree === true, toggle: () => setLocalFilters((p) => ({ ...p, isFree: p.isFree ? undefined : true })) },
                { key: 'outdoor', label: t('events.outdoor', 'Al aire libre'), icon: Trees, on: localFilters.isOutdoor === true, toggle: () => setLocalFilters((p) => ({ ...p, isOutdoor: p.isOutdoor ? undefined : true })) },
                { key: 'tickets', label: t('events.withTickets', 'Con entradas'), icon: Ticket, on: localFilters.withTickets === true, toggle: () => setLocalFilters((p) => ({ ...p, withTickets: p.withTickets ? undefined : true })) },
                { key: 'weekend', label: t('common.thisWeekend', 'Este finde'), icon: Users, on: localFilters.datePreset === 'weekend', toggle: () => setLocalFilters((p) => ({ ...p, datePreset: p.datePreset === 'weekend' ? undefined : 'weekend' })) },
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={preset.toggle}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]',
                    preset.on
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card hover:bg-accent border-border/60 text-foreground'
                  )}
                  aria-pressed={preset.on}
                >
                  <preset.icon className="h-3.5 w-3.5" aria-hidden />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>


          <div className="space-y-3">
            <Label>{t('events.date')}</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !localFilters.dateFrom && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateFrom
                      ? format(localFilters.dateFrom, 'PP')
                      : t('events.dateFrom')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateFrom}
                    onSelect={(date) =>
                      setLocalFilters((prev) => ({ ...prev, dateFrom: date }))
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !localFilters.dateTo && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {localFilters.dateTo
                      ? format(localFilters.dateTo, 'PP')
                      : t('events.dateTo')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={localFilters.dateTo}
                    onSelect={(date) =>
                      setLocalFilters((prev) => ({ ...prev, dateTo: date }))
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label>{t('events.category')}</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map((category) => (
                <CategoryChip
                  key={category}
                  category={category}
                  size="sm"
                  isSelected={localFilters.categories.includes(category)}
                  onClick={() => handleCategoryToggle(category)}
                />
              ))}
            </div>
          </div>

          {/* Free only */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="free-only"
              checked={localFilters.isFree === true}
              onCheckedChange={(checked) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  isFree: checked ? true : undefined,
                }))
              }
            />
            <Label htmlFor="free-only" className="cursor-pointer">
              {t('events.freeOnly')}
            </Label>
          </div>

          {/* With tickets */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="with-tickets"
              checked={localFilters.withTickets === true}
              onCheckedChange={(checked) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  withTickets: checked ? true : undefined,
                }))
              }
            />
            <Label htmlFor="with-tickets" className="cursor-pointer">
              {t('events.withTickets', 'Con entradas')}
            </Label>
          </div>

          {/* Family / Kids */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="family-kids"
              checked={localFilters.familyKids === true}
              onCheckedChange={(checked) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  familyKids: checked ? true : undefined,
                }))
              }
            />
            <Label htmlFor="family-kids" className="cursor-pointer">
              {t('events.familyKids', 'Infantil / Familiar')}
            </Label>
          </div>

          {/* Outdoor */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-outdoor"
              checked={localFilters.isOutdoor === true}
              onCheckedChange={(checked) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  isOutdoor: checked ? true : undefined,
                }))
              }
            />
            <Label htmlFor="is-outdoor" className="cursor-pointer">
              {t('events.outdoor', 'Al aire libre')}
            </Label>
          </div>


          {/* Favorites only */}
          {showFavoritesFilter && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="favorites-only"
                checked={localFilters.onlyFavorites === true}
                onCheckedChange={(checked) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    onlyFavorites: checked ? true : undefined,
                  }))
                }
              />
              <Label htmlFor="favorites-only" className="cursor-pointer">
                {t('events.onlyFavorites')}
              </Label>
            </div>
          )}
        </div>

        <DrawerFooter className="flex-row gap-2 border-t border-border/60 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <Button
            variant="ghost"
            onClick={handleClearFilters}
            disabled={activeCount === 0}
            className="flex-1"
          >
            {t('events.clearFilters', 'Limpiar')}
          </Button>
          <Button onClick={handleApply} className="flex-[2] font-semibold">
            {activeCount > 0
              ? `${t('events.showResults', 'Mostrar')} · ${activeCount}`
              : t('events.showAll', 'Mostrar todo')}
          </Button>
        </DrawerFooter>

      </DrawerContent>
    </Drawer>
  );
};

export default FilterDrawer;
