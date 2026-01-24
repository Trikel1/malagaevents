import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventCategory } from '@/types';

interface CategoryChipProps {
  category: EventCategory;
  isSelected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'default';
}

const categoryColors: Record<EventCategory, string> = {
  music: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  theater: 'bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300',
  exhibitions: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  kids: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300',
  sports: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300',
  festivals: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
  workshops: 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300',
  conferences: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/30 dark:text-slate-300',
  other: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900/30 dark:text-gray-300',
};

const CategoryChip = ({ category, isSelected, onClick, size = 'default' }: CategoryChipProps) => {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'sm' : 'default'}
      onClick={onClick}
      className={cn(
        'rounded-full whitespace-nowrap transition-all',
        categoryColors[category],
        isSelected && 'ring-2 ring-primary ring-offset-2',
        size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4'
      )}
    >
      {t(`categories.${category}`)}
    </Button>
  );
};

export default CategoryChip;
