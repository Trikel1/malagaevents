import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdaptivePopover } from './AdaptivePopover';
import { cn } from '@/lib/utils';

export interface MultiSelectOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  hint?: React.ReactNode;
  group?: string;
  disabled?: boolean;
}

export interface MultiSelectProps<V extends string = string> {
  values: V[];
  onValuesChange: (values: V[]) => void;
  options: MultiSelectOption<V>[];
  title: string;
  description?: string;
  ariaLabel: string;
  triggerLabel: React.ReactNode;
  triggerIcon?: React.ReactNode;
  loading?: boolean;
  error?: React.ReactNode;
  emptyLabel?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * MultiSelect with draft selection: changes stay local until "Apply" is pressed.
 * Escape (or close) discards the draft. Adaptive: bottom sheet on mobile, popover on desktop.
 */
export function MultiSelect<V extends string = string>({
  values,
  onValuesChange,
  options,
  title,
  description,
  ariaLabel,
  triggerLabel,
  triggerIcon,
  loading,
  error,
  emptyLabel,
  align = 'start',
  className,
}: MultiSelectProps<V>) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<V[]>(values);
  const contentId = React.useId();

  React.useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const toggle = (v: V) => {
    setDraft((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleApply = () => {
    onValuesChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft([]);
  };

  const selectedCount = values.length;

  const grouped = React.useMemo(() => {
    const map = new Map<string, MultiSelectOption<V>[]>();
    for (const opt of options) {
      const key = opt.group ?? '';
      const arr = map.get(key) ?? [];
      arr.push(opt);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [options]);

  const trigger = (
    <Button
      type="button"
      variant={selectedCount > 0 ? 'default' : 'outline'}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      aria-label={ariaLabel}
      className={cn('gap-2 min-w-0', className)}
    >
      {triggerIcon}
      <span className="truncate">{triggerLabel}</span>
      {selectedCount > 0 && (
        <span
          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-xs font-semibold"
          aria-label={t('common.selectedCount', '{{count}} seleccionados', { count: selectedCount })}
        >
          {selectedCount}
        </span>
      )}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
    </Button>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={handleClear}
        disabled={draft.length === 0}
      >
        {t('common.clear', 'Limpiar')}
      </Button>
      <Button type="button" onClick={handleApply} className="min-w-[120px]">
        {t('common.apply', 'Aplicar')}
        {draft.length > 0 && <span className="ml-1.5 opacity-90">({draft.length})</span>}
      </Button>
    </div>
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
      footer={footer}
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t('common.loading', 'Cargando...')}
        </div>
      ) : error ? (
        <div className="py-6 px-4 text-center text-sm text-destructive">{error}</div>
      ) : options.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {emptyLabel ?? t('common.noResults', 'Sin resultados')}
        </div>
      ) : (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable="true"
          className="py-1 px-1.5"
        >
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
                const isChecked = draft.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isChecked}
                      disabled={opt.disabled}
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm',
                        'min-h-[44px] transition-colors duration-[var(--liquid-motion-fast)]',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:pointer-events-none disabled:opacity-50',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2 transition-colors',
                          isChecked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input bg-card',
                        )}
                      >
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-xs text-muted-foreground shrink-0">{opt.hint}</span>
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
