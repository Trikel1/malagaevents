/**
 * VenueKindFilter — Simple, public-friendly replacement for VenueGroupDropdown.
 *
 * Two layers:
 *  1) Inline row of chips (radio): Todos / Salas / Teatros y auditorios / Museos / Festivales.
 *     Applies instantly, no draft, no "Aplicar".
 *  2) A subtle text link "Ver todos los recintos" that opens a minimal bottom sheet
 *     (popover on desktop) with a search and two default sections: Málaga capital / Provincia.
 *     Single-select. Tapping a venue filters immediately and closes.
 *
 * Frontend-only. Uses mergeVenues() from venueFilters — no DB, ingestion or events changes.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Check, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useVenues } from '@/hooks/useVenues';
import { useIsMobile } from '@/hooks/use-mobile';
import { mergeVenues, normalize, type MergedVenue } from '@/lib/venueFilters';
import type { VenueKind } from '@/lib/venuesCatalog';

export type VenueKindFilterValue =
  | 'all'
  | 'sala'
  | 'teatro-auditorio'
  | 'museo'
  | 'festival';

interface VenueKindFilterProps {
  selectedKind: VenueKindFilterValue;
  selectedVenueId: string | null;
  selectedVenueName?: string | null;
  onKindChange: (kind: VenueKindFilterValue) => void;
  onVenueChange: (venueId: string | null, venueName: string | null) => void;
  /** Currently selected localities in the parent filter (used to prioritise ordering). */
  priorityCities?: string[];
}

const KIND_MATCHES: Record<Exclude<VenueKindFilterValue, 'all'>, VenueKind[]> = {
  'sala': ['sala', 'espacio'],
  'teatro-auditorio': ['teatro', 'auditorio'],
  'museo': ['museo'],
  'festival': ['festival', 'exterior', 'ferial'],
};

export function venueMatchesKind(kind: VenueKindFilterValue, vKind: VenueKind): boolean {
  if (kind === 'all') return true;
  return KIND_MATCHES[kind].includes(vKind);
}

/**
 * Given the merged catalog and a chip kind, return the real DB venue ids that
 * belong to that kind. Used by EventsPage to filter events server-side.
 */
export function venueIdsForKind(merged: MergedVenue[], kind: VenueKindFilterValue): string[] {
  if (kind === 'all') return [];
  return merged
    .filter((v) => v.id && v.hasEvents && venueMatchesKind(kind, v.kind))
    .map((v) => v.id as string);
}

export function VenueKindFilter({
  selectedKind,
  selectedVenueId,
  selectedVenueName,
  onKindChange,
  onVenueChange,
  priorityCities,
}: VenueKindFilterProps) {
  const { t } = useTranslation();
  const { data: venues = [] } = useVenues();
  const [sheetOpen, setSheetOpen] = useState(false);

  const merged = useMemo(() => mergeVenues(venues), [venues]);

  const chips: Array<{ id: VenueKindFilterValue; label: string }> = [
    { id: 'all', label: t('events.kindAll', 'Todos') },
    { id: 'sala', label: t('events.kindHalls', 'Salas') },
    { id: 'teatro-auditorio', label: t('events.kindTheaters', 'Teatros y auditorios') },
    { id: 'museo', label: t('events.kindMuseums', 'Museos') },
    { id: 'festival', label: t('events.kindFestivals', 'Festivales') },
  ];

  return (
    <div className="space-y-2">
      {/* Selected venue pill (removable) */}
      {selectedVenueId && selectedVenueName && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onVenueChange(null, null)}
            className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-sm"
            aria-label={t('events.removeVenueFilter', 'Quitar filtro de recinto')}
          >
            <span className="truncate max-w-[220px]">{selectedVenueName}</span>
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Chip row + inline "Ver todos los recintos" link */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label={t('events.venueKindLabel', 'Tipo de recinto')}
        >
          {chips.map((c) => {
            const active = !selectedVenueId && selectedKind === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  onVenueChange(null, null);
                  onKindChange(c.id);
                }}
                className={cn(
                  'shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="shrink-0 text-xs font-medium text-primary hover:underline whitespace-nowrap inline-flex items-center gap-0.5"
        >
          {t('events.seeAllVenues', 'Ver todos los recintos')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <VenuePickerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        merged={merged}
        selectedKind={selectedKind}
        selectedVenueId={selectedVenueId}
        onKindChange={onKindChange}
        onVenueChange={onVenueChange}
        priorityCities={priorityCities}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

type SheetKindChip = VenueKindFilterValue;

interface VenuePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merged: MergedVenue[];
  selectedKind: VenueKindFilterValue;
  selectedVenueId: string | null;
  onKindChange: (kind: VenueKindFilterValue) => void;
  onVenueChange: (id: string | null, name: string | null) => void;
  priorityCities?: string[];
}

const isMalagaCity = (c?: string | null) => !!c && /m[aá]laga/i.test(c);

function VenuePickerSheet({
  open,
  onOpenChange,
  merged,
  selectedKind,
  selectedVenueId,
  onKindChange,
  onVenueChange,
  priorityCities,
}: VenuePickerSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [innerKind, setInnerKind] = useState<SheetKindChip>(selectedKind);
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch('');
      setInnerKind(selectedKind);
      setShowAllCatalog(false);
    }
  }, [open, selectedKind]);

  const chips: Array<{ id: SheetKindChip; label: string }> = [
    { id: 'all', label: t('events.kindAll', 'Todos') },
    { id: 'sala', label: t('events.kindHalls', 'Salas') },
    { id: 'teatro-auditorio', label: t('events.kindTheaters', 'Teatros y auditorios') },
    { id: 'museo', label: t('events.kindMuseums', 'Museos') },
  ];

  const q = normalize(search);
  const priorityNorm = (priorityCities ?? []).map(normalize).filter(Boolean);

  const filtered = useMemo(() => {
    return merged.filter((v) => {
      if (!venueMatchesKind(innerKind, v.kind)) return false;
      if (q && !v.searchTokens.some((tok) => tok.includes(q))) return false;
      return true;
    });
  }, [merged, innerKind, q]);

  // Split: with events (default view) + without (catalog completo)
  const active = filtered.filter((v) => v.hasEvents);
  const inactive = filtered.filter((v) => !v.hasEvents);

  interface Section { key: string; label: string; items: MergedVenue[] }

  const sections = useMemo<Section[]>(() => {
    const cmp = (a: MergedVenue, b: MergedVenue) => a.name.localeCompare(b.name, 'es');

    // Priority locality section first (if any and yields items)
    const priorityCityMatch = (v: MergedVenue) =>
      priorityNorm.some((p) => normalize(v.city).includes(p));

    const out: Section[] = [];
    if (priorityNorm.length) {
      const inPriority = active.filter(priorityCityMatch).sort(cmp);
      if (inPriority.length) {
        const label = priorityCities?.[0] ?? '';
        out.push({ key: 'priority', label, items: inPriority });
      }
    }
    const restActive = active.filter((v) => !priorityCityMatch(v));
    const capital = restActive.filter((v) => v.zone === 'malaga-ciudad').sort(cmp);
    const provincia = restActive.filter((v) => v.zone !== 'malaga-ciudad').sort(cmp);
    if (capital.length) {
      out.push({
        key: 'capital',
        label: t('events.venuesCapital', 'Málaga capital'),
        items: capital,
      });
    }
    if (provincia.length) {
      out.push({
        key: 'provincia',
        label: t('events.venuesProvincia', 'Provincia'),
        items: provincia,
      });
    }
    return out;
  }, [active, priorityNorm, priorityCities, t]);

  const inactiveSorted = useMemo(
    () => [...inactive].sort((a, b) => {
      const am = isMalagaCity(a.city) ? 0 : 1;
      const bm = isMalagaCity(b.city) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.name.localeCompare(b.name, 'es');
    }),
    [inactive],
  );

  const handlePickVenue = useCallback((v: MergedVenue) => {
    if (!v.id) return;
    onKindChange('all');
    onVenueChange(v.id, v.name);
    onOpenChange(false);
  }, [onKindChange, onVenueChange, onOpenChange]);

  const totalActive = active.length;

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-3 border-b space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('events.venuesSearchSimple', 'Buscar recinto o ciudad')}
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
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => {
            const activeChip = innerKind === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setInnerKind(c.id)}
                aria-pressed={activeChip}
                className={cn(
                  'shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap',
                  activeChip
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="p-2">
          {sections.length === 0 && !showAllCatalog ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {t('events.venuesEmptyTitle', 'Sin recintos que coincidan')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('events.venuesEmptyHint', 'Prueba otra categoría o busca por nombre de sala o municipio.')}
              </p>
            </div>
          ) : (
            <>
              {sections.map((section, idx) => (
                <div key={section.key} className={cn(idx > 0 && 'mt-3')}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((v) => (
                      <VenueRow
                        key={(v.id ?? '') + v.slug}
                        venue={v}
                        selected={selectedVenueId === v.id}
                        onClick={() => handlePickVenue(v)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Catálogo completo (sin agenda) */}
              {inactiveSorted.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  {!showAllCatalog ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCatalog(true)}
                      className="w-full text-left px-2 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      {t('events.showFullCatalog', 'Ver catálogo completo')}{' '}
                      <span className="opacity-70">({inactiveSorted.length})</span>
                    </button>
                  ) : (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('events.venuesCatalogFull', 'Catálogo completo')}
                      </div>
                      <p className="px-2 pb-2 text-[11px] text-muted-foreground/80">
                        {t('events.venuesNoAgendaHint', 'Aún sin agenda publicada.')}
                      </p>
                      <div className="space-y-0.5">
                        {inactiveSorted.map((v) => (
                          <VenueRow
                            key={v.slug}
                            venue={v}
                            selected={false}
                            onClick={() => {}}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer: minimal — only shows count */}
      {totalActive > 0 && (
        <div className="px-3 py-2 border-t text-[11px] text-muted-foreground text-center">
          {t('events.venuesActiveCount', {
            count: totalActive,
            defaultValue: '{{count}} recintos con agenda',
          })}
        </div>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col',
          isMobile ? 'h-[82vh]' : 'w-[420px] sm:max-w-[420px]',
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="p-4 pb-2 text-left border-b">
          <SheetTitle className="text-base">
            {t('events.venuesTitleShort', 'Recintos')}
          </SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

interface VenueRowProps {
  venue: MergedVenue;
  selected: boolean;
  onClick: () => void;
}

function VenueRow({ venue, selected, onClick }: VenueRowProps) {
  const disabled = !venue.hasEvents;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-left transition-colors min-h-[40px]',
        !disabled && 'hover:bg-accent cursor-pointer',
        disabled && 'opacity-55 cursor-not-allowed',
        selected && 'bg-accent',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{venue.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {venue.city}
        </div>
      </div>
      {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
    </button>
  );
}

export default VenueKindFilter;
