import { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'error';
}

const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, variant = 'default' }, ref) => {
    return (
      <div ref={ref} className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className={cn(
          "rounded-full p-4 mb-4",
          variant === 'error' ? 'bg-destructive/10' : 'bg-muted'
        )}>
          <Icon className={cn(
            "h-10 w-10",
            variant === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )} />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-sm mb-4 max-w-xs">{description}</p>
        )}
        <div className="flex gap-2 flex-wrap justify-center">
          {actionLabel && onAction && (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>
          )}
        </div>
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';

export default EmptyState;
