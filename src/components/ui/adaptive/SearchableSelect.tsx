import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdaptivePopover } from './AdaptivePopover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption<V extends string = string> {
  value: V;
  label: string;
  hint?: React.ReactNode;
  group?: string;
  /** Extra strings used for search matching (aliases, city, etc.) */
  aliases?: string[];
  disabled?: boolean;
}

export interface SearchableSelectProps<V extends string = string> {
  value: V | null;
  onValueChange: (value: V | null) => void;
  options: SearchableSelectOption<V>[];
  title: string;
  description?: string;
  ariaLabel: string;
  triggerLabel: React.ReactNode;
  triggerIcon?: React.ReactNode;
  triggerActive?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  error?: React.ReactNode;
  emptyLabel?: React.ReactNode;
  clearLabel?: string;
  /** Include a "clear/all" pinned option at the top */
  allowClear?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * SearchableSelect — adaptive single-select with visible search input.
 * Groups render with sticky headers. Adaptive: bottom sheet on mobile, popover on desktop.
 */
export function SearchableSelect<V extends string = string>({
  value,
  onValueChange,
  options,
  title,
  description,
  ariaLabel,
  triggerLabel,
  triggerIcon,
  triggerActive,
  searchPlaceholder,
  loading,
  error,
  emptyLabel,
  clearLabel,
  allowClear = true,
  align = 'start',
  className,
}: SearchableSelectProps<V>) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const isMobile = useIsMobile();
  const contentId = React.useId();

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = normalize(query);
    return options.filter(
      (o) =>
        normalize(o.label).includes(q) || (o.aliases ?? []).some((a) => normalize(a).includes(q)),
    );
  }, [options, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, SearchableSelectOption<V>[]>();
    for (const o of filtered) {
      const key = o.group ?? '';
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const trigger = (
    <Button
      type="button"
      variant={triggerActive ? 'default' : 'outline'}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={ariaLabel}
      className={cn('gap-2 min-w-0', className)}
    >
      {triggerIcon}
      <span className="truncate">{triggerLabel}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
    </Button>
  );

  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={title}
      description={description}
      align={align}
      contentId={contentId}
    >
      <div className="sticky top-0 z-20 bg-card border-b border-border/60 p-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={searchPlaceholder ?? t('common.search', 'Buscar...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus={!isMobile}
            aria-label={searchPlaceholder ?? t('common.search', 'Buscar...')}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('common.loading', 'Cargando...')}
        </div>
      ) : error ? (
        <div className="py-6 px-4 text-center text-sm text-destructive">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {emptyLabel ?? t('common.noResults', 'Sin resultados')}
        </div>
      ) : (
        <ul role="listbox" aria-label={ariaLabel} className="py-1 px-1.5">
          {allowClear && value !== null && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onValueChange(null);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left rounded-[10px] px-3 py-2.5 text-sm min-h-[44px]',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {clearLabel ?? t('common.clear', 'Limpiar')}
              </button>
            </li>
          )}
          {grouped.map(([groupLabel, opts]) => (
            <React.Fragment key={groupLabel || 'default'}>
              {groupLabel && (
                <li
                  className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  aria-hidden="true"
                >
                  {groupLabel}
                </li>
              )}
              {opts.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm',
                        'min-h-[44px] transition-colors duration-[var(--liquid-motion-fast)]',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:pointer-events-none disabled:opacity-50',
                        isSelected && 'bg-accent/60',
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-xs text-muted-foreground shrink-0">{opt.hint}</span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })}
            </React.Fragment>
          ))}
        </ul>
      )}
    </AdaptivePopover>
  );
}
