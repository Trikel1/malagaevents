import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Search, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { INTEREST_CATALOG, interestsByDomain, type InterestDefinition } from './catalog';
import { normalize } from './ranking';
import { useInterests } from './useInterests';

interface InterestPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEARCH_THRESHOLD = 12;

const InterestPicker = ({ open, onOpenChange }: InterestPickerProps) => {
  const { t } = useTranslation();
  const { interests, isGuest, status, save, reset, isLoading, remoteFailed, storageBlocked } =
    useInterests();
  const [draft, setDraft] = useState<string[]>(interests);
  const [query, setQuery] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);

  // Re-seed the draft each time the dialog opens or the stored value changes.
  useEffect(() => {
    if (open) {
      setDraft(interests);
      setQuery('');
      setSaveFailed(false);
    }
  }, [open, interests]);

  const label = (def: InterestDefinition) => t(`interests.items.${def.labelKey}`);

  const filter = (list: InterestDefinition[]) => {
    const q = normalize(query);
    if (!q) return list;
    return list.filter((def) => normalize(label(def)).includes(q) || def.id.includes(q));
  };

  const groups = useMemo(
    () => [
      { key: 'culture' as const, items: filter(interestsByDomain('culture')) },
      { key: 'sports' as const, items: filter(interestsByDomain('sports')) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, t],
  );

  const toggle = (id: string) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    const ok = await save(draft);
    setSaveFailed(!ok);
    if (ok) onOpenChange(false);
  };

  // Only empty the draft once the deletion actually succeeded: a blocked write
  // must not look like a cleared selection.
  const handleReset = async () => {
    const ok = await reset();
    setSaveFailed(!ok);
    if (ok) setDraft([]);
  };

  const noResults = groups.every((g) => g.items.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('interests.title')}</DialogTitle>
          <DialogDescription>{t('interests.description')}</DialogDescription>
        </DialogHeader>

        {INTEREST_CATALOG.length > SEARCH_THRESHOLD && (
          <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-background">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('interests.searchPlaceholder')}
              aria-label={t('interests.searchPlaceholder')}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm"
            />
          </div>
        )}

        <div className="space-y-5">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.key} aria-labelledby={`interests-group-${group.key}`}>
                <h3
                  id={`interests-group-${group.key}`}
                  className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-2"
                >
                  {t(`interests.groups.${group.key}`)}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((def) => {
                    const selected = draft.includes(def.id);
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => toggle(def.id)}
                        aria-pressed={selected}
                        className={cn(
                          'inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted',
                        )}
                      >
                        {selected && <Check className="h-4 w-4" aria-hidden />}
                        {label(def)}
                      </button>
                    );
                  })}
                </div>
              </section>
            ),
          )}
          {noResults && (
            <p className="text-sm text-muted-foreground">{t('interests.noMatches')}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {isGuest
            ? storageBlocked
              ? t('interests.deviceBlocked')
              : t('interests.savedOnDevice')
            : remoteFailed
            ? t('interests.syncFailed')
            : t('interests.syncedWithAccount')}
        </p>

        {(status === 'error' || saveFailed) && (
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            {t('interests.saveError')}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={handleReset}
            disabled={draft.length === 0 && interests.length === 0}
          >
            {t('interests.clear')}
          </Button>
          <Button
            type="button"
            className="h-11 font-semibold"
            onClick={handleSave}
            disabled={status === 'saving' || isLoading}
          >
            {status === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
            {status === 'saving' ? t('interests.saving') : t('interests.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InterestPicker;
