import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Building2, Loader2, Search, X, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  mergeVenues,
  filterMerged,
  groupIntoSections,
  VENUE_CATEGORIES,
  type VenueCategory,
  type MergedVenue,
} from '@/lib/venueFilters';

// Backwards-compatible group type: EventsPage still consumes this.
export type VenueGroup = 'all' | 'theaters' | 'halls';

interface VenueGroupDropdownProps {
  selectedGroup: VenueGroup;
  selectedVenueIds: string[];
  onGroupChange: (group: VenueGroup) => void;
  onVenueIdsChange: (venueIds: string[]) => void;
  /** Optional cities to prioritise (e.g. currently picked locality names). */
  priorityCities?: string[];
}

export function VenueGroupDropdown({
  selectedGroup: _selectedGroup,
  selectedVenueIds,
  onGroupChange,
  onVenueIdsChange,
  priorityCities,
}: VenueGroupDropdownProps) {
  const { t } = useTranslation();
  const { data: venues = [], isLoading, isError } = useVenues();
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<VenueCategory>('all');
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>(selectedVenueIds);

  // Sync draft on open
  useEffect(() => {
    if (open) {
      setDraftIds(selectedVenueIds);
      setSearch('');
      // Default view: if a priority city is set, jump to "all" so it surfaces first
      setCategory(priorityCities && priorityCities.length ? 'all' : 'all');
    }
  }, [open, selectedVenueIds, priorityCities]);

  const merged = useMemo(() => mergeVenues(venues), [venues]);

  const filtered = useMemo(
    () => filterMerged(merged, { category, search, priorityCities }),
    [merged, category, search, priorityCities],
  );

  const sections = useMemo(() => groupIntoSections(filtered, category), [filtered, category]);

  const toggleDraft = useCallback((id: string) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleApply = useCallback(() => {
    onVenueIdsChange(draftIds);
    // Keep backwards compat: mark 'all' when nothing chosen.
    onGroupChange(draftIds.length === 0 ? 'all' : 'halls');
    setOpen(false);
  }, [draftIds, onVenueIdsChange, onGroupChange]);

  const handleClear = useCallback(() => {
    setDraftIds([]);
    onVenueIdsChange([]);
    onGroupChange('all');
    setOpen(false);
  }, [onVenueIdsChange, onGroupChange]);

  const activeCount = selectedVenueIds.length;

  const trigger = (
    <Button
      variant={activeCount > 0 ? 'default' : 'outline'}
      className={cn(
        'w-full h-11 gap-2 justify-between px-3 sm:px-4 rounded-xl',
        activeCount > 0 && 'shadow-sm',
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">
          {activeCount > 0
            ? t('events.venuesSelected', { count: activeCount, defaultValue: '{{count}} recintos' })
            : t('events.venuesTitle', 'Salas, teatros y recintos')}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {activeCount > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
            {activeCount}
          </Badge>
        )}
        <ChevronDown className="h-4 w-4 opacity-70" />
      </span>
    </Button>
  );

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-3 border-b space-y-2.5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t('events.venuesTitle', 'Salas, teatros y recintos')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('events.venuesSubtitle', 'Busca por nombre o explora Málaga capital y provincia.')}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('events.venuesSearchPlaceholder', 'Buscar: Térmica, Cervantes, Estepona…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
            autoFocus={!isMobile}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent"
              aria-label={t('common.clear', 'Limpiar')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VENUE_CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={active}
                className={cn(
                  'shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {t(`events.venueCategories.${c.id}`, c.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {t('errors.generic', 'Error al cargar')}
            </div>
          ) : sections.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {t('events.venuesEmptyTitle', 'Sin recintos que coincidan')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('events.venuesEmptyHint', 'Prueba otra categoría o busca por nombre de sala o municipio.')}
              </p>
            </div>
          ) : (
            sections.map((section, idx) => (
              <div key={section.key} className={cn(idx > 0 && 'mt-3')}>
                <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 opacity-60" />
                  {section.label}
                  <span className="text-muted-foreground/60 font-normal normal-case">
                    · {section.items.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {section.items.map((v) => (
                    <VenueRow
                      key={v.slug + (v.id ?? '')}
                      venue={v}
                      selected={v.id ? draftIds.includes(v.id) : false}
                      onToggle={() => v.id && toggleDraft(v.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-9 text-sm text-muted-foreground"
          onClick={handleClear}
        >
          {t('common.clear', 'Limpiar')}
        </Button>
        <Button size="sm" className="flex-1 h-9" onClick={handleApply}>
          {t('common.show', 'Mostrar')}
          {draftIds.length > 0 && (
            <span className="ml-1.5 opacity-80">({draftIds.length})</span>
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="w-full" onClick={() => setOpen(true)}>{trigger}</div>
        <SheetContent
          side="bottom"
          className="h-[85vh] p-0 flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="p-4 pb-2 text-left border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              {t('events.venuesTitle', 'Salas, teatros y recintos')}
            </SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="w-full">{trigger}</div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(420px,calc(100vw-24px))] p-0 flex flex-col h-[520px]"
        align="center"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

interface VenueRowProps {
  venue: MergedVenue;
  selected: boolean;
  onToggle: () => void;
}

function VenueRow({ venue, selected, onToggle }: VenueRowProps) {
  const { t } = useTranslation();
  const disabled = !venue.hasEvents;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors min-h-[40px]',
        !disabled && 'hover:bg-accent cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
        selected && 'bg-accent/70',
      )}
      aria-pressed={selected}
    >
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {disabled ? (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
        ) : (
          <Checkbox checked={selected} className="h-4 w-4 pointer-events-none" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate">{venue.name}</span>
          {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {venue.city}
          {disabled && (
            <span className="ml-1.5 text-muted-foreground/70">
              · {t('events.venueNoAgenda', 'sin agenda aún')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default VenueGroupDropdown;
