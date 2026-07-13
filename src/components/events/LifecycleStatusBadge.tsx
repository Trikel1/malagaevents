import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LifecycleStatus =
  | 'scheduled'
  | 'postponed'
  | 'cancelled'
  | 'sold_out'
  | 'finished'
  | 'needs_review'
  | null
  | undefined;

interface LifecycleStatusBadgeProps {
  status: LifecycleStatus;
  className?: string;
}

/**
 * Visual status badge for cultural events.
 * Only renders when the status conveys information the user needs
 * (i.e. anything but `scheduled` which is the implicit default).
 */
export const LifecycleStatusBadge = ({ status, className }: LifecycleStatusBadgeProps) => {
  if (!status || status === 'scheduled') return null;

  const config: Record<Exclude<LifecycleStatus, null | undefined | 'scheduled'>, {
    label: string;
    classes: string;
  }> = {
    postponed: {
      label: 'Aplazado',
      classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
    },
    cancelled: {
      label: 'Cancelado',
      classes: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
    },
    sold_out: {
      label: 'Agotado',
      classes: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40',
    },
    finished: {
      label: 'Finalizado',
      classes: 'bg-muted text-muted-foreground border-border',
    },
    needs_review: {
      label: 'En revisión',
      classes: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
    },
  };

  const { label, classes } = config[status as keyof typeof config];

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-semibold uppercase tracking-wide', classes, className)}
    >
      {label}
    </Badge>
  );
};
