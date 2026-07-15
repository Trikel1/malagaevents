import { useEffect, useState } from 'react';
import {
  CircleDollarSign,
  Clock3,
  Moon,
  Sunrise,
  SunMedium,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CULTURAL_GROUP_LABELS,
  EMPTY_CALENDAR_FILTERS,
  countActiveGroups,
  type CalendarFilters,
  type CalendarMoment,
  type CulturalGroupId,
} from '@/lib/calendarFilters';
import { SPORT_LABELS, type SportCategory } from '@/types/sports';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'eventos' | 'deportes';
  filters: CalendarFilters;
  onApply: (f: CalendarFilters) => void;
  onClear: () => void;
  /** Category ids present in the current month. */
  availableCategories: string[];
  /** Number of plans that would show with the pending filters this month. */
  resultCount: number;
  /** Live setter so the result count updates as the user tweaks the draft. */
  onDraftChange?: (f: CalendarFilters) => void;
}

const MOMENTS: Array<{
  id: CalendarMoment;
  label: string;
  hint?: string;
  icon: LucideIcon;
}> = [
  { id: 'any', label: 'Cualquier hora', icon: Clock3 },
  { id: 'morning', label: 'Mañana', hint: 'antes de las 14:00', icon: Sunrise },
  { id: 'afternoon', label: 'Tarde', hint: '14:00–20:00', icon: SunMedium },
  { id: 'evening', label: 'Noche', hint: 'desde las 20:00', icon: Moon },
];

const CalendarFilterDrawer = ({
  open,
  onOpenChange,
  mode,
  filters,
  onApply,
  onClear,
  availableCategories,
  resultCount,
  onDraftChange,
}: Props) => {
  const [draft, setDraft] = useState<CalendarFilters>(filters);

  // Sync draft when the drawer opens or the applied filters change from outside.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const update = (patch: Partial<CalendarFilters>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      onDraftChange?.(next);
      return next;
    });
  };

  const toggleCategory = (id: string) => {
    setDraft((prev) => {
      const has = prev.categories.includes(id);
      const next = {
        ...prev,
        categories: has ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
      };
      onDraftChange?.(next);
      return next;
    });
  };

  const handleClear = () => {
    setDraft(EMPTY_CALENDAR_FILTERS);
    onDraftChange?.(EMPTY_CALENDAR_FILTERS);
    onClear();
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const activeCount = countActiveGroups(draft);
  const labelFor = (id: string) =>
    mode === 'deportes'
      ? (SPORT_LABELS[id as SportCategory] ?? id)
      : (CULTURAL_GROUP_LABELS[id as CulturalGroupId] ?? id);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh] max-h-[92dvh] flex flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-col [&>div:last-child]:overflow-hidden">
        <DrawerHeader className="flex items-start justify-between gap-2 text-left">
          <div className="min-w-0">
            <DrawerTitle>Afina tu agenda</DrawerTitle>
            <DrawerDescription>Elige qué te apetece y a qué hora.</DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div
          data-vaul-no-drag
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-6 pt-2 space-y-6 [-webkit-overflow-scrolling:touch]"
        >
          {/* Plan fácil — only cultural */}
          {mode !== 'deportes' && (
            <section className="space-y-2" aria-labelledby="filter-plan-facil">
              <h3 id="filter-plan-facil" className="text-sm font-semibold">Plan fácil</h3>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={draft.isFree}
                  onClick={() => update({ isFree: !draft.isFree })}
                  icon={CircleDollarSign}
                  label="Gratis"
                />
                <FilterChip
                  active={draft.withTickets}
                  onClick={() => update({ withTickets: !draft.withTickets })}
                  icon={Ticket}
                  label="Con entradas"
                />
              </div>
            </section>
          )}

          {/* Tu momento */}
          <section className="space-y-2" aria-labelledby="filter-momento">
            <h3 id="filter-momento" className="text-sm font-semibold">Tu momento</h3>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tu momento">
              {MOMENTS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.moment === m.id}
                    onClick={() => update({ moment: m.id })}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-11 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.moment === m.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card hover:bg-accent border-border/60 text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{m.label}</span>
                    {m.hint && (
                      <span
                        className={cn(
                          'text-xs',
                          draft.moment === m.id ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}
                      >
                        · {m.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Qué te apetece */}
          <section className="space-y-2" aria-labelledby="filter-categorias">
            <h3 id="filter-categorias" className="text-sm font-semibold">Qué te apetece</h3>
            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay categorías para mostrar este mes.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((id) => {
                  const active = draft.categories.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategory(id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-11 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card hover:bg-accent border-border/60 text-foreground',
                      )}
                    >
                      {labelFor(id)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sticky, fully opaque footer — no transparency */}
        <div
          className="border-t border-border bg-background px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex items-center gap-2"
          style={{ position: 'sticky', bottom: 0 }}
        >
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={activeCount === 0}
            className="h-11 flex-1"
          >
            Limpiar
          </Button>
          <Button onClick={handleApply} className="h-11 flex-[2] font-semibold">
            {`Ver ${resultCount} planes este mes`}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

interface ChipProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}
const FilterChip = ({ active, onClick, icon: Icon, label }: ChipProps) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3.5 min-h-11 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active
        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
        : 'bg-card hover:bg-accent border-border/60 text-foreground',
    )}
  >
    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
    {label}
  </button>
);

export default CalendarFilterDrawer;
