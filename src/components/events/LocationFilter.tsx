import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, ChevronDown, Check, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLocations } from '@/hooks/useLocations';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LOCALITIES_CATALOG,
  ZONE_LABELS,
  ZONE_ORDER,
  MALAGA_CAPITAL_SLUG,
  type ZoneKey,
} from '@/lib/localitiesCatalog';
import type { Location } from '@/types';

interface LocationFilterProps {
  selectedLocationIds: string[];
  onSelectionChange: (locationIds: string[]) => void;
  variant?: 'button' | 'icon';
  showLabel?: boolean;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const LocationFilter = ({
  selectedLocationIds,
  onSelectionChange,
}: LocationFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();

  const { data: dbLocations = [], isLoading } = useLocations();

  // Build slug -> Location (db) map for resolving selection
  const dbBySlug = useMemo(() => {
    const map = new Map<string, Location>();
    for (const loc of dbLocations) {
      if (loc.normalized_name) map.set(loc.normalized_name, loc);
    }
    return map;
  }, [dbLocations]);

  // Build the curated list: only catalog entries that exist in DB (so filtering works)
  const availableEntries = useMemo(() => {
    return LOCALITIES_CATALOG.filter((e) => dbBySlug.has(e.slug));
  }, [dbBySlug]);

  // Determine current selection (single-select semantics; "all" when empty)
  const selectedEntry = useMemo(() => {
    if (selectedLocationIds.length === 0) return null; // "Toda la provincia"
    const id = selectedLocationIds[0];
    const loc = dbLocations.find((l) => l.id === id);
    if (!loc) return null;
    return LOCALITIES_CATALOG.find((e) => e.slug === loc.normalized_name)
      ?? { slug: loc.normalized_name || '', name: loc.name, zone: 'capital' as ZoneKey };
  }, [selectedLocationIds, dbLocations]);

  // Default behaviour: if nothing has been chosen yet, the trigger SHOWS "Málaga"
  // but the actual filter remains empty (= all province) until the user picks one.
  // We surface "Málaga" as the visual default per spec.
  const triggerLabel = selectedLocationIds.length === 0
    ? t('events.locationDefault', 'Málaga')
    : selectedEntry?.name ?? t('events.allProvince', 'Toda la provincia');

  const isActive = selectedLocationIds.length > 0;

  useEffect(() => {
    if (open) setSearchQuery('');
  }, [open]);

  const matchesQuery = (entry: { name: string; aliases?: string[] }) => {
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
    if (normalize(entry.name).includes(q)) return true;
    return (entry.aliases ?? []).some((a) => normalize(a).includes(q));
  };

  const grouped = useMemo(() => {
    const byZone = new Map<ZoneKey, typeof availableEntries>();
    for (const e of availableEntries) {
      if (!matchesQuery(e)) continue;
      const arr = byZone.get(e.zone) ?? [];
      arr.push(e);
      byZone.set(e.zone, arr);
    }
    // Sort within zone: priority desc, then name
    for (const [, arr] of byZone) {
      arr.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name, 'es'));
    }
    return ZONE_ORDER
      .map((z) => ({ zone: z, label: ZONE_LABELS[z], entries: byZone.get(z) ?? [] }))
      .filter((g) => g.entries.length > 0);
  }, [availableEntries, searchQuery]);

  const handleSelectSlug = (slug: string | null) => {
    if (slug === null) {
      onSelectionChange([]); // Toda la provincia
    } else {
      const loc = dbBySlug.get(slug);
      if (loc) onSelectionChange([loc.id]);
    }
    setOpen(false);
  };

  const handleSelectMalagaDefault = () => {
    const malaga = dbBySlug.get(MALAGA_CAPITAL_SLUG);
    if (malaga) onSelectionChange([malaga.id]);
    setOpen(false);
  };

  const trigger = (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      className={cn(
        'h-9 px-3 gap-1.5 max-w-full whitespace-nowrap rounded-full',
        !isActive && 'bg-card hover:bg-accent border-border/60',
        isActive && 'shadow-sm'
      )}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium truncate max-w-[140px]">{triggerLabel}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
    </Button>
  );

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('events.searchLocality', 'Buscar localidad')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
            autoFocus={!isMobile}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="p-1.5">
          {/* Quick options */}
          <button
            type="button"
            onClick={() => handleSelectSlug(null)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-left text-sm hover:bg-accent transition-colors min-h-[44px]',
              selectedLocationIds.length === 0 && 'bg-accent/60'
            )}
          >
            <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 font-medium">{t('events.allProvince', 'Toda la provincia')}</span>
            {selectedLocationIds.length === 0 && <Check className="h-4 w-4 text-primary" />}
          </button>

          {dbBySlug.has(MALAGA_CAPITAL_SLUG) && (
            <button
              type="button"
              onClick={handleSelectMalagaDefault}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-left text-sm hover:bg-accent transition-colors min-h-[44px]',
                selectedEntry?.slug === MALAGA_CAPITAL_SLUG && 'bg-accent/60'
              )}
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 font-medium">{t('events.locationDefault', 'Málaga')}</span>
              <span className="text-[11px] text-muted-foreground">{ZONE_LABELS.capital}</span>
              {selectedEntry?.slug === MALAGA_CAPITAL_SLUG && <Check className="h-4 w-4 text-primary ml-2" />}
            </button>
          )}

          {isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('common.loading', 'Cargando...')}
            </div>
          )}

          {!isLoading && grouped.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t('common.noResults', 'Sin resultados')}
            </div>
          )}

          {/* Grouped by zone (skip "capital" if its only entry — Málaga — is shown above) */}
          {grouped.map((group) => {
            const entries = group.zone === 'capital'
              ? group.entries.filter((e) => e.slug !== MALAGA_CAPITAL_SLUG)
              : group.entries;
            if (entries.length === 0) return null;
            return (
              <div key={group.zone} className="mt-3">
                <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {entries.map((e) => {
                  const isSelected = selectedEntry?.slug === e.slug;
                  return (
                    <button
                      key={e.slug}
                      type="button"
                      onClick={() => handleSelectSlug(e.slug)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-left text-sm hover:bg-accent transition-colors min-h-[44px]',
                        isSelected && 'bg-accent/60'
                      )}
                    >
                      <span className="flex-1 truncate">{e.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {isActive && (
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-9 text-sm text-muted-foreground"
            onClick={() => handleSelectSlug(null)}
          >
            {t('events.clearLocality', 'Limpiar localidad')}
          </Button>
        </div>
      )}
    </div>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="p-4 pb-2 text-left border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              {t('events.locality', 'Localidad')}
            </SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 flex flex-col h-[420px]"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </PopoverContent>
    </Popover>
  );
};

export default LocationFilter;
