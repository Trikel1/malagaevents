import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, MapPin, Search, X } from 'lucide-react';
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
  groupCapital,
  mergeVenues,
  normalize,
  venueMatchesKinds,
  type MergedVenue,
} from '@/lib/venueFilters';
import type { VenueKind } from '@/lib/venuesCatalog';


/**
 * Premium venue navigation.
 *
 * Outside: three icon buttons — Todo · Salas · Teatros.
 * Inside : multi-select picker (sheet on mobile, popover on desktop),
 *          with sticky Limpiar / Mostrar footer.
 */

type Kind = 'all' | 'salas' | 'teatros';

interface VenueKindFilterProps {
  selectedVenueIds: string[];
  onVenueIdsChange: (venueIds: string[]) => void;
  priorityCities?: string[];
}

const KIND_TO_KINDS: Record<Kind, VenueKind[] | 'all'> = {
  all: 'all',
  salas: ['sala', 'espacio'],
  teatros: ['teatro', 'auditorio'],
};

// ────────────────────────────────────────────────────────────────────────────
// Custom SVG icons — composed, elegant, works at 20/24/32px, light+dark.
// ────────────────────────────────────────────────────────────────────────────

interface IconProps {
  className?: string;
  size?: number;
}

/** Three rounded tiles + spark — "all / discovery". */
function IconTodo({ className, size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="14" width="7.5" height="7.5" rx="2" />
      <path d="M17.25 15.5 l0.9 1.8 l1.8 0.9 l-1.8 0.9 l-0.9 1.8 l-0.9 -1.8 l-1.8 -0.9 l1.8 -0.9 z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Rounded stage with mic + two soundwaves — "salas / live". */
function IconSalas({ className, size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* stage arch */}
      <path d="M3.5 18 V12 a8.5 8.5 0 0 1 17 0 v6" />
      <path d="M2.5 18 h19" />
      {/* mic capsule */}
      <rect x="10.25" y="8.5" width="3.5" height="6" rx="1.75" />
      <path d="M8.5 12.75 a3.5 3.5 0 0 0 7 0" />
      <path d="M12 16.25 V18" />
      {/* soundwaves */}
      <path d="M6 11.5 c0.8 -0.8 0.8 -2 0 -2.8" opacity="0.85" />
      <path d="M18 11.5 c-0.8 -0.8 -0.8 -2 0 -2.8" opacity="0.85" />
    </svg>
  );
}

/** Proscenium curtain with two drapes + stage base — "teatros". */
function IconTeatros({ className, size = 22 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* pelmet */}
      <path d="M3.5 5 h17" />
      <path d="M3.5 5 v1.5 a2 2 0 0 0 2 2 a2 2 0 0 0 2 -2 a2 2 0 0 0 2 2 a2 2 0 0 0 2 -2 a2 2 0 0 0 2 2 a2 2 0 0 0 2 -2 a2 2 0 0 0 2 2 a2 2 0 0 0 2 -2 V5" />
      {/* left drape */}
      <path d="M5 9 C 5 13, 6.5 16, 7.5 18.5" />
      <path d="M7.5 9 C 8 13, 8.75 16.5, 9 19" />
      {/* right drape */}
      <path d="M19 9 C 19 13, 17.5 16, 16.5 18.5" />
      <path d="M16.5 9 C 16 13, 15.25 16.5, 15 19" />
      {/* stage base */}
      <path d="M4 20 h16" />
    </svg>
  );
}

const KIND_META: Record<Kind, { Icon: (p: IconProps) => JSX.Element; labelKey: string; labelFallback: string }> = {
  all: { Icon: IconTodo, labelKey: 'events.venueKind.all', labelFallback: 'Todo' },
  salas: { Icon: IconSalas, labelKey: 'events.venueKind.halls', labelFallback: 'Salas' },
  teatros: { Icon: IconTeatros, labelKey: 'events.venueKind.theaters', labelFallback: 'Teatros' },
};

// ────────────────────────────────────────────────────────────────────────────

/** Shorten a long venue name for compact pills, keeping full name in aria-label. */
function shortenVenueName(name: string): string {
  const patterns: Array<[RegExp, string]> = [
    [/^Teatro del Soho.*$/i, 'Soho'],
    [/^Teatro Cervantes.*$/i, 'Cervantes'],
    [/^Teatro Echegaray.*$/i, 'Echegaray'],
    [/^Teatro Cánovas.*$/i, 'Cánovas'],
    [/^Auditorio Edgar Neville.*$/i, 'Edgar Neville'],
    [/^Auditorio Eduardo Ocón.*$/i, 'Eduardo Ocón'],
    [/^Auditorio Municipal .*Torres.*$/i, 'Cortijo de Torres'],
    [/^Sala Trinchera.*$/i, 'Trinchera'],
    [/^Sala París 15.*$/i, 'París 15'],
    [/^La Cochera Cabaret.*$/i, 'La Cochera'],
    [/^La Térmica.*$/i, 'La Térmica'],
    [/^Museo Picasso.*$/i, 'M. Picasso'],
    [/^Museo Thyssen.*$/i, 'M. Thyssen'],
    [/^Contenedor Cultural.*$/i, 'Contenedor UMA'],
  ];
  for (const [re, short] of patterns) if (re.test(name)) return short;
  if (name.length <= 22) return name;
  return name.replace(/^(Teatro|Sala|Auditorio|Museo|Centro)\s+/i, '').slice(0, 22);
}

// ────────────────────────────────────────────────────────────────────────────

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
  const [draft, setDraft] = useState<string[]>([]);

  const merged = useMemo(() => mergeVenues(venues), [venues]);

  // Look up selected venue objects for the pill row.
  const selectedVenues = useMemo(() => {
    if (selectedVenueIds.length === 0) return [];
    return selectedVenueIds
      .map((id) => merged.find((m) => m.id === id))
      .filter((v): v is MergedVenue => !!v);
  }, [merged, selectedVenueIds]);

  // Open picker: reset local state, prime draft with current selection.
  useEffect(() => {
    if (openKind) {
      setSearch('');
      setDraft(selectedVenueIds);
    }
  }, [openKind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by kind button — considers extraKinds so Teatro Romano appears in Teatros.
  const kindPreFiltered = useMemo(() => {
    if (!openKind) return [];
    const kinds = KIND_TO_KINDS[openKind];
    return kinds === 'all' ? merged : merged.filter((v) => venueMatchesKinds(v, kinds));
  }, [merged, openKind]);

  // Search filter (accent-insensitive) — applied on top of kind pre-filter.
  const filtered = useMemo(
    () => filterMerged(kindPreFiltered, { category: 'all', search, priorityCities }),
    [kindPreFiltered, search, priorityCities],
  );

  // Split capital / provincia. Both include catalog-only rows.
  const capitalItems = useMemo(
    () => filtered.filter((v) => v.zone === 'malaga-ciudad'),
    [filtered],
  );
  const provinciaItems = useMemo(
    () => filtered.filter((v) => v.zone !== 'malaga-ciudad'),
    [filtered],
  );

  // Group capital by category (Teatros y auditorios, Salas, etc.)
  const capitalGroups = useMemo(() => groupCapital(capitalItems), [capitalItems]);

  // Group provincia by city (Málaga capital always first is a no-op here).
  const provinciaByCity = useMemo(() => {
    const priority = (priorityCities ?? []).map(normalize).filter(Boolean);
    const buckets = new Map<string, MergedVenue[]>();
    for (const v of provinciaItems) {
      const arr = buckets.get(v.city) ?? [];
      arr.push(v);
      buckets.set(v.city, arr);
    }
    const cities = Array.from(buckets.keys()).sort((a, b) => {
      const ap = priority.some((p) => normalize(a).includes(p)) ? 0 : 1;
      const bp = priority.some((p) => normalize(b).includes(p)) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.localeCompare(b, 'es');
    });
    return cities.map((c) => ({
      key: c,
      label: c,
      items: (buckets.get(c) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
  }, [provinciaItems, priorityCities]);

  const totalCount = filtered.length;
  const capitalCount = capitalItems.length;

  const toggleDraft = useCallback((id: string | null) => {
    if (!id) return;
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleApply = useCallback(() => {
    if (draft.length === 0 && openKind && openKind !== 'all') {
      // Empty draft → select every DB-backed venue matching this kind button.
      const kinds = KIND_TO_KINDS[openKind];
      const all = merged.filter(
        (v) => v.hasEvents && v.id && kinds !== 'all' && venueMatchesKinds(v, kinds),
      );
      onVenueIdsChange(all.map((v) => v.id!) as string[]);
    } else {
      onVenueIdsChange(draft);
    }
    setOpenKind(null);
  }, [draft, openKind, merged, onVenueIdsChange]);

  const handleClearDraft = useCallback(() => setDraft([]), []);

  const handleRemoveOne = useCallback(
    (id: string) => onVenueIdsChange(selectedVenueIds.filter((x) => x !== id)),
    [selectedVenueIds, onVenueIdsChange],
  );

  const handleClearAll = useCallback(() => onVenueIdsChange([]), [onVenueIdsChange]);

  const currentKind = openKind;
  const highlight = search ? normalize(search) : '';

  const pickerTitle = openKind
    ? openKind === 'all'
      ? t('events.venuesTitle2', 'Recintos')
      : openKind === 'salas'
        ? t('events.venueKind.hallsTitle', 'Salas')
        : t('events.venueKind.theatersTitle', 'Teatros y auditorios')
    : '';

  const applyLabel = (() => {
    if (draft.length === 1) return t('events.showOneVenue', 'Mostrar 1 recinto');
    if (draft.length > 1)
      return t('events.showNVenues', {
        count: draft.length,
        defaultValue: `Mostrar ${draft.length} recintos`,
      });
    // Empty draft → contextual "Mostrar all X"
    if (openKind === 'salas') return t('events.showAllHalls', 'Mostrar todas las salas');
    if (openKind === 'teatros') return t('events.showAllTheaters', 'Mostrar todos los teatros');
    return t('events.showAll', 'Mostrar todo');
  })();


  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="p-3 border-b">
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

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="p-2 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {t('errors.generic', 'Error al cargar')}
            </div>
          ) : sections.length === 0 && catalogItems.length === 0 ? (
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
              {sections.map((section, idx) => (
                <SectionBlock
                  key={'a-' + section.key}
                  label={section.label}
                  items={section.items}
                  selectedIds={draft}
                  onToggle={toggleDraft}
                  highlight={highlight}
                  className={idx > 0 ? 'mt-3' : ''}
                />
              ))}

              {catalogItems.length > 0 && (
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
                  {showCatalog && (
                    <SectionBlock
                      label={t('events.catalogSectionLabel', 'Sin agenda activa')}
                      items={catalogItems}
                      selectedIds={draft}
                      onToggle={toggleDraft}
                      highlight={highlight}
                      className="mt-1"
                      subdued
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Sticky footer */}
      <div className="border-t p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex items-center gap-2 bg-background/95 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearDraft}
          disabled={draft.length === 0}
          className="h-10 px-3 text-sm"
        >
          {t('common.clear', 'Limpiar')}
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          className="h-10 flex-1 text-sm font-semibold"
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Three icon buttons */}
      <div
        className="grid grid-cols-3 gap-2"
        role="toolbar"
        aria-label={t('events.venuesTitle2', 'Recintos')}
      >
        {(['all', 'salas', 'teatros'] as Kind[]).map((k) => {
          const { Icon, labelKey, labelFallback } = KIND_META[k];
          const isActive = openKind === k;
          return (
            <KindButton
              key={k}
              label={t(labelKey, labelFallback)}
              Icon={Icon}
              active={isActive}
              onClick={() => setOpenKind(k)}
            />
          );
        })}
      </div>

      {/* Selected venues summary */}
      {selectedVenues.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5">
          {selectedVenues.length <= 3 ? (
            selectedVenues.map((v) => (
              <span
                key={v.id!}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 max-w-full"
                title={v.name}
              >
                <span className="truncate max-w-[180px]">{shortenVenueName(v.name)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveOne(v.id!)}
                  aria-label={t('common.clearOne', 'Quitar') + ' ' + v.name}
                  className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                {t('events.nVenuesSelected', {
                  count: selectedVenues.length,
                  defaultValue: `${selectedVenues.length} recintos seleccionados`,
                })}
              </span>
              <button
                type="button"
                onClick={() => setOpenKind('all')}
                className="text-xs text-primary underline-offset-2 hover:underline px-1.5 h-6"
              >
                {t('common.edit', 'Editar')}
              </button>
            </>
          )}
          {selectedVenues.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline px-1.5 h-6"
            >
              {t('events.clearVenues', 'Limpiar recintos')}
            </button>
          )}
        </div>
      )}

      {isMobile ? (
        <Sheet open={openKind !== null} onOpenChange={(o) => !o && setOpenKind(null)}>
          <SheetContent
            side="bottom"
            className="h-[88vh] p-0 flex flex-col"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <SheetHeader className="p-4 pb-3 text-left border-b">
              <SheetTitle className="flex items-center gap-2 text-base">
                {currentKind && <PickerHeaderIcon kind={currentKind} />}
                {pickerTitle}
              </SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={openKind !== null} onOpenChange={(o) => !o && setOpenKind(null)}>
          <PopoverTrigger asChild>
            <span className="sr-only" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(460px,calc(100vw-24px))] p-0 flex flex-col h-[560px]"
            align="center"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="px-4 pt-3 pb-2 border-b flex items-center gap-2 text-sm font-semibold">
              {currentKind && <PickerHeaderIcon kind={currentKind} />}
              {pickerTitle}
            </div>
            {body}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function PickerHeaderIcon({ kind }: { kind: Kind }) {
  const { Icon } = KIND_META[kind];
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon size={16} />
    </span>
  );
}

interface KindButtonProps {
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  active: boolean;
  onClick: () => void;
}

function KindButton({ label, Icon, active, onClick }: KindButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'group relative flex items-center justify-center gap-2 h-12 sm:h-11 px-2 sm:px-3',
        'rounded-2xl border transition-all duration-150',
        'bg-gradient-to-b from-background/90 to-background/60 backdrop-blur-md',
        'border-border/70 hover:border-primary/50 hover:shadow-sm',
        'active:scale-[0.98] motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active && 'border-primary/70 shadow-md ring-1 ring-primary/30',
      )}
    >
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          'bg-gradient-to-br from-primary/10 to-primary/5',
          'text-primary transition-colors',
          'group-hover:from-primary/20 group-hover:to-primary/10',
          active && 'from-primary/25 to-primary/10',
        )}
      >
        <Icon size={20} />
      </span>
      <span className="text-sm font-semibold tracking-tight truncate">
        {label}
      </span>
    </button>
  );
}

interface SectionBlockProps {
  label: string;
  items: MergedVenue[];
  selectedIds: string[];
  onToggle: (id: string | null) => void;
  highlight: string;
  className?: string;
  subdued?: boolean;
}

function SectionBlock({
  label,
  items,
  selectedIds,
  onToggle,
  className,
  subdued,
}: SectionBlockProps) {
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
            selected={!!v.id && selectedIds.includes(v.id)}
            onToggle={() => onToggle(v.id)}
            subdued={subdued}
          />
        ))}
      </div>
    </div>
  );
}

interface VenueRowProps {
  venue: MergedVenue;
  selected: boolean;
  onToggle: () => void;
  subdued?: boolean;
}

function VenueRow({ venue, selected, onToggle, subdued }: VenueRowProps) {
  const { t } = useTranslation();
  const disabled = !venue.hasEvents;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors min-h-[42px]',
        !disabled && 'hover:bg-accent cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
        selected && 'bg-primary/10',
        subdued && 'opacity-70',
      )}
    >
      <span
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all',
          selected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border/70 bg-background',
        )}
        aria-hidden
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm truncate', selected && 'font-medium')}>{venue.name}</div>
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
