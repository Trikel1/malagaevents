import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeroProps {
  title: ReactNode;
  description?: ReactNode;
  kicker?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: 'default' | 'compact';
  tone?: 'brand' | 'muted';
  className?: string;
  titleId?: string;
}

/**
 * Shared PageHero used across public interior routes.
 *
 * - Título con Space Grotesk (font-display) y jerarquía consistente.
 * - Fondo con un gradiente ambiental de marca muy controlado.
 * - Contenedor 1240px con gutters coherentes con TopNav.
 * - Slot para acciones y para contenido debajo (buscador, filtros, chips…).
 */
export function PageHero({
  title,
  description,
  kicker,
  icon,
  actions,
  children,
  variant = 'default',
  tone = 'brand',
  className,
  titleId,
}: PageHeroProps) {
  const isCompact = variant === 'compact';

  return (
    <section
      className={cn(
        'relative overflow-hidden border-b border-border/60',
        tone === 'brand' ? 'bg-card' : 'bg-muted/40',
        className,
      )}
      aria-labelledby={titleId}
    >
      {tone === 'brand' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.10]">
          <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-secondary blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-40 w-40 rounded-full bg-accent blur-3xl" />
        </div>
      )}

      <div
        className={cn(
          'relative mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8',
          isCompact ? 'pt-6 pb-5 lg:pt-8 lg:pb-6' : 'pt-8 pb-8 lg:pt-12 lg:pb-10',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            {kicker && (
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
                {kicker}
              </div>
            )}
            <div className="flex items-start gap-3 mt-3">
              {icon && (
                <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h1
                  id={titleId}
                  className={cn(
                    'font-display font-bold tracking-tight text-foreground',
                    isCompact
                      ? 'text-2xl sm:text-3xl lg:text-[2rem]'
                      : 'text-[1.9rem] sm:text-4xl lg:text-[2.75rem] leading-[1.05]',
                  )}
                >
                  {title}
                </h1>
                {description && (
                  <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

export default PageHero;
