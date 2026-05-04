import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { EventCategory } from '@/types';

interface CategoryChipProps {
  category: EventCategory;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'default';
}

// Static class mapping (Tailwind needs literal class names at build time).
const categoryStyles: Record<EventCategory, { surface: string; dot: string }> = {
  music: {
    surface:
      'bg-purple-50/90 text-purple-800 border-purple-200/70 hover:bg-purple-100/90 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50',
    dot: 'bg-purple-500',
  },
  theater: {
    surface:
      'bg-pink-50/90 text-pink-800 border-pink-200/70 hover:bg-pink-100/90 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-800/50',
    dot: 'bg-pink-500',
  },
  exhibitions: {
    surface:
      'bg-amber-50/90 text-amber-800 border-amber-200/70 hover:bg-amber-100/90 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/50',
    dot: 'bg-amber-500',
  },
  kids: {
    surface:
      'bg-cyan-50/90 text-cyan-800 border-cyan-200/70 hover:bg-cyan-100/90 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800/50',
    dot: 'bg-cyan-500',
  },
  sports: {
    surface:
      'bg-emerald-50/90 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/50',
    dot: 'bg-emerald-500',
  },
  festivals: {
    surface:
      'bg-violet-50/90 text-violet-800 border-violet-200/70 hover:bg-violet-100/90 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800/50',
    dot: 'bg-violet-500',
  },
  workshops: {
    surface:
      'bg-teal-50/90 text-teal-800 border-teal-200/70 hover:bg-teal-100/90 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800/50',
    dot: 'bg-teal-500',
  },
  conferences: {
    surface:
      'bg-slate-50/90 text-slate-800 border-slate-200/70 hover:bg-slate-100/90 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700/60',
    dot: 'bg-slate-500',
  },
  nightlife: {
    surface:
      'bg-indigo-50/90 text-indigo-800 border-indigo-200/70 hover:bg-indigo-100/90 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800/50',
    dot: 'bg-indigo-500',
  },
  other: {
    surface:
      'bg-stone-50/90 text-stone-800 border-stone-200/70 hover:bg-stone-100/90 dark:bg-stone-900/60 dark:text-stone-200 dark:border-stone-700/60',
    dot: 'bg-stone-500',
  },
};

const CategoryChip = ({ category, isSelected, onClick, size = 'default' }: CategoryChipProps) => {
  const { t } = useTranslation();
  const styles = categoryStyles[category] ?? categoryStyles.other;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        'active:scale-[0.97]',
        size === 'sm' ? 'h-8 px-3.5 text-xs' : 'h-9 px-4 text-sm',
        isSelected
          ? 'bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/40'
          : styles.surface,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full opacity-80',
          isSelected ? 'bg-primary' : styles.dot,
        )}
      />
      <span>{t(`categories.${category}`)}</span>
    </button>
  );
};

export default CategoryChip;
