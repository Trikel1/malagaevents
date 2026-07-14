import * as React from 'react';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export interface AdaptivePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Width applied on desktop only. Default: 360px, max viewport - 24 */
  desktopWidth?: string;
  /** Popover align on desktop */
  align?: 'start' | 'center' | 'end';
  className?: string;
  /** Optional id used to link trigger aria-controls */
  contentId?: string;
}

/**
 * Adaptive container that renders as bottom Sheet on mobile (< 768px)
 * and as a Popover anchored to the trigger on desktop.
 *
 * Guarantees:
 *  - Never opens outside the viewport (collisionPadding respects TopNav/BottomNav).
 *  - Escape / outside click close.
 *  - Focus returns to trigger.
 *  - Single internal scroll container (children responsibility).
 */
export function AdaptivePopover({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  desktopWidth,
  align = 'start',
  className,
  contentId,
}: AdaptivePopoverProps) {
  const isMobile = useIsMobile();
  const headingId = React.useId();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          id={contentId}
          aria-labelledby={headingId}
          className={cn(
            'flex flex-col p-0 rounded-t-[20px] max-h-[85dvh] h-auto',
            'pb-[env(safe-area-inset-bottom)]',
            className,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex-none px-4 pt-3 pb-2 border-b border-border/60 bg-card">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={headingId} className="text-base font-semibold text-foreground truncate">
                  {title}
                </h2>
                {description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cerrar"
                className="-mr-2 -mt-1 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
          {footer && (
            <div className="flex-none border-t border-border/60 bg-card px-4 py-3">
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        id={contentId}
        aria-labelledby={headingId}
        align={align}
        side="bottom"
        sideOffset={8}
        collisionPadding={{ top: 72, bottom: 96, left: 12, right: 12 }}
        avoidCollisions
        className={cn(
          'p-0 flex flex-col overflow-hidden',
          desktopWidth ?? 'w-[min(360px,calc(100vw-24px))]',
          className,
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex-none px-3 py-2.5 border-b border-border/60">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id={headingId} className="text-sm font-semibold text-foreground truncate">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              className="h-9 w-9 min-h-[36px] min-w-[36px] -mr-1"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {footer && (
          <div className="flex-none border-t border-border/60 px-3 py-2.5 bg-card">
            {footer}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
