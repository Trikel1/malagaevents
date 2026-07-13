import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  filterMerged,
  groupIntoSections,
  mergeVenues,
  normalize,
  type MergedVenue,
  type VenueCategory,
} from '@/lib/venueFilters';
import type { VenueKind } from '@/lib/venuesCatalog';

/** Three simple buttons that each open the venue picker sheet pre-filtered. */
type Kind = 'all' | 'salas' | 'teatro-auditorio';

interface VenueKindFilterProps {
  selectedVenueIds: string[];
  onVenueIdsChange: (venueIds: string[]) => void;
  /** Cities to surface first (e.g. currently selected locality). */
  priorityCities?: string[];
}

const KIND_TO_KINDS: Record<Kind, VenueKind[] | 'all'> = {
  all: 'all',
  salas: ['sala', 'espacio'],
  'teatro-auditorio': ['teatro', 'auditorio'],
};

export function VenueKindFilter({
  selectedVenueIds,
  onVenueIdsChange,
  priorityCities,
}: VenueKindFilterProps) {
  const { t } = useTranslation();
  const { data: venues = [], isLoading, isError } = useVenues();
  const isMobile = useIsMobile();

  const [openKind, setOpenKind] = useState<Kind | null>(null);
  const [search, setSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  const merged = useMemo(() => mergeVenues(venues), [venues]);

  const selectedVenueName = useMemo(() => {
    if (selectedVenueIds.length === 0) return null;
    const v = merged.find((m) => m.id && selectedVenueIds.includes(m.id));
    return v?.name ?? null;
  }, [merged, selectedVenueIds]);

  useEffect(() => {
    if (openKind) {
      setSearch('');
      setShowCatalog(false);
    }
  }, [openKind]);

  // Pre-filter by kind, then reuse filterMerged for search + priority sort.
  const filtered = useMemo(() => {
    if (!openKind) return [];
    const kinds = KIND_TO_KINDS[openKind];
    const preList =
      kinds === 'all' ? merged : merged.filter((v) => kinds.includes(v.kind));
    const category: VenueCategory = 'all';
    const list = filterMerged(preList, { category, search, priorityCities });
    return list;
  }, [merged, openKind, search, priorityCities]);

  const activeItems = useMemo(() => filtered.filter((v) => v.hasEvents), [filtered]);
  const catalogItems = useMemo(() => filtered.filter((v) => !v.hasEvents), [filtered]);

  const activeSections = useMemo(
    () => groupIntoSections(activeItems, 'all'),
    [activeItems],
  );
  const catalogSections = useMemo(
    () => groupIntoSections(catalogItems, 'all'),
    [catalogItems],
  );

  const handleSelectVenue = useCallback(
    (id: string | null) => {
      if (!id) return;
      onVenueIdsChange([id]);
      setOpenKind(null);
    },
    [onVenueIdsChange],
  );

  const handleClearVenue = useCallback(() => {
    onVenueIdsChange([]);
  }, [onVenueIdsChange]);

  const kindLabels: Record<Kind, string> = {
    all: t('events.venueKind.all', 'Todo'),
    salas: t('events.venueKind.halls', 'Salas'),
    'teatro-auditorio': t('events.venueKind.theaters', 'Teatros'),
  };

  const currentKind = openKind;
  const highlight = search ? normalize(search) : '';

  const body = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('events.venuesSearchPlaceholder2', 'Buscar recinto o ciudad')}
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
      </div>

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
          ) : activeSections.length === 0 && catalogSections.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {t('events.venuesEmptyTitle', 'Sin recintos que coincidan')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('events.venuesEmptyHint2', 'Prueba otra búsqueda o cambia de categoría.')}
              </p>
            </div>
          ) : (
            <>
              {activeSections.map((section, idx) => (
                <SectionBlock
                  key={'a-' + section.key}
                  label={sectionLabel(section.key, section.label, priorityCities, t)}
                  items={section.items}
                  onSelect={handleSelectVenue}
                  highlight={highlight}
                  className={idx > 0 ? 'mt-3' : ''}
                />
              ))}

              {catalogSections.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCatalog((s) => !s)}
                    className="w-full text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 hover:text-foreground transition-colors"
                  >
                    {showCatalog
                      ? t('events.venuesHideCatalog', 'Ocultar catálogo completo')
                      : t('events.venuesShowCatalog', 'Ver catálogo completo')}
                    <span className="ml-1.5 text-muted-foreground/60 font-normal normal-case">
                      · {catalogItems.length}
                    </span>
                  </button>
                  {showCatalog &&
                    catalogSections.map((section, idx) => (
                      <SectionBlock
                        key={'c-' + section.key}
                        label={section.label}
                        items={section.items}
                        onSelect={handleSelectVenue}
                        highlight={highlight}
                        className={idx > 0 ? 'mt-3' : 'mt-1'}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const title = t('events.venuesTitle2', 'Recintos');

  return (
    <div className="space-y-2">
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label={title}
      >
        {(['all', 'salas', 'teatro-auditorio'] as Kind[]).map((k) => (
          <KindButton
            key={k}
            label={kindLabels[k]}
            onClick={() => setOpenKind(k)}
          />
        ))}
      </div>

      {selectedVenueName && (
        <div className="flex items-center">
          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 max-w-full">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[220px]">{selectedVenueName}</span>
            <button
              type="button"
              onClick={handleClearVenue}
              aria-label={t('common.clear', 'Limpiar')}
              className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {isMobile ? (
        <Sheet open={openKind !== null} onOpenChange={(o) => !o && setOpenKind(null)}>
          <SheetContent
            side="bottom"
            className="h-[85vh] p-0 flex flex-col"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SheetHeader className="p-4 pb-2 text-left border-b">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                {title}
                {currentKind && currentKind !== 'all' && (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {kindLabels[currentKind]}
                  </span>
                )}
              </SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={openKind !== null} onOpenChange={(o) => !o && setOpenKind(null)}>
          {/* Invisible anchor near the buttons */}
          <PopoverTrigger asChild>
            <span className="sr-only" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(420px,calc(100vw-24px))] p-0 flex flex-col h-[520px]"
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="px-3 pt-3 pb-1 border-b flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              {title}
              {currentKind && currentKind !== 'all' && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {kindLabels[currentKind]}
                </span>
              )}
            </div>
            {body}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function sectionLabel(
  key: string,
  fallback: string,
  priorityCities: string[] | undefined,
  t: (k: string, d: string) => string,
): string {
  const priority = (priorityCities ?? []).map((c) => c.toLowerCase());
  if (priority.includes(key.toLowerCase())) return fallback; // keep locality name
  if (/m[aá]laga$/i.test(key)) return t('events.sectionCapital', 'Málaga capital');
  return fallback;
}

interface KindButtonProps {
  label: string;
  onClick: () => void;
}

function KindButton({ label, onClick }: KindButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-9 px-4 rounded-full text-sm font-medium shrink-0',
        'bg-background/80 backdrop-blur-sm border-border/70',
        'hover:bg-accent hover:border-border transition-colors',
      )}
    >
      {label}
    </Button>
  );
}

interface SectionBlockProps {
  label: string;
  items: MergedVenue[];
  onSelect: (id: string | null) => void;
  highlight: string;
  className?: string;
}

function SectionBlock({ label, items, onSelect, highlight, className }: SectionBlockProps) {
  return (
    <div className={className}>
      <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3 w-3 opacity-60" />
        {label}
        <span className="text-muted-foreground/60 font-normal normal-case">
          · {items.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {items.map((v) => (
          <VenueRow
            key={v.slug + (v.id ?? '')}
            venue={v}
            highlight={highlight}
            onSelect={() => onSelect(v.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface VenueRowProps {
  venue: MergedVenue;
  highlight: string;
  onSelect: () => void;
}

function VenueRow({ venue, onSelect }: VenueRowProps) {
  const { t } = useTranslation();
  const disabled = !venue.hasEvents;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors min-h-[40px]',
        !disabled && 'hover:bg-accent cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{venue.name}</div>
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

export default VenueKindFilter;
