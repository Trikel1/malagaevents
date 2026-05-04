import {
  Trophy,
  Footprints,
  Bike,
  Waves,
  Car,
  Hand,
  Award,
  Volleyball,
  Shield,
  Medal,
  Mountain,
  Dumbbell,
  Swords,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SportCategory } from '@/types/sports';
import type { SVGProps } from 'react';

// ---------------------------------------------------------------------------
// Custom inline SVG pictograms — minimalist, single-stroke, currentColor.
// Designed to mimic the Lucide visual language (24x24, stroke 2, round caps)
// so they sit perfectly next to other Lucide icons.
// ---------------------------------------------------------------------------

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

const baseSvgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Soccer ball: circle + central pentagon + short panel hints. */
const FootballIcon = ({ className, size, ...rest }: IconProps) => (
  <svg
    {...baseSvgProps}
    {...(size ? { width: size, height: size } : null)}
    className={className}
    aria-hidden="true"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" />
    {/* central pentagon */}
    <path d="M12 8.2 L15.2 10.6 L14 14.4 L10 14.4 L8.8 10.6 Z" />
    {/* 5 short panel seams radiating outward */}
    <path d="M12 8.2 L12 5" />
    <path d="M15.2 10.6 L18 9.6" />
    <path d="M14 14.4 L15.6 17" />
    <path d="M10 14.4 L8.4 17" />
    <path d="M8.8 10.6 L6 9.6" />
  </svg>
);

/** Basketball: circle + vertical seam + two curved side seams. */
const BasketballIcon = ({ className, size, ...rest }: IconProps) => (
  <svg
    {...baseSvgProps}
    {...(size ? { width: size, height: size } : null)}
    className={className}
    aria-hidden="true"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3 L12 21" />
    <path d="M3.5 9 C 7 11, 7 13, 3.5 15" />
    <path d="M20.5 9 C 17 11, 17 13, 20.5 15" />
  </svg>
);

interface SportVisual {
  Icon: LucideIcon | ((props: IconProps) => JSX.Element);
  /** Subtle ring color used only in premium badge mode */
  ring: string;
}

/**
 * Static visual map. Keys cover canonical SportCategory values + common aliases
 * present in real scraped data (running, padel, ciclismo, natacion, triatlon…).
 * No dynamic Tailwind class composition — every class is a literal string.
 */
export const SPORT_VISUAL_MAP: Record<string, SportVisual> = {
  futbol: { Icon: FootballIcon, ring: 'ring-emerald-500/25' },
  futsal: { Icon: FootballIcon, ring: 'ring-emerald-500/25' },
  baloncesto: { Icon: BasketballIcon, ring: 'ring-orange-500/25' },
  balonmano: { Icon: Hand, ring: 'ring-blue-500/25' },
  atletismo: { Icon: Footprints, ring: 'ring-amber-500/25' },
  running: { Icon: Footprints, ring: 'ring-amber-500/25' },
  triatlon: { Icon: Medal, ring: 'ring-fuchsia-500/25' },
  ciclismo: { Icon: Bike, ring: 'ring-sky-500/25' },
  natacion: { Icon: Waves, ring: 'ring-cyan-500/25' },
  acuaticos: { Icon: Waves, ring: 'ring-cyan-500/25' },
  tenis: { Icon: Trophy, ring: 'ring-lime-500/25' },
  padel: { Icon: Trophy, ring: 'ring-lime-500/25' },
  voleibol: { Icon: Volleyball, ring: 'ring-violet-500/25' },
  rugby: { Icon: Shield, ring: 'ring-rose-500/25' },
  motor: { Icon: Car, ring: 'ring-zinc-500/25' },
  senderismo: { Icon: Mountain, ring: 'ring-stone-500/25' },
  fitness: { Icon: Dumbbell, ring: 'ring-rose-500/25' },
  artes_marciales: { Icon: Swords, ring: 'ring-red-500/25' },
  otros: { Icon: Award, ring: 'ring-primary/25' },
};

export const getSportIcon = (sport: string) =>
  (SPORT_VISUAL_MAP[sport]?.Icon ?? Award) as LucideIcon;

export const getSportRing = (sport: string): string =>
  SPORT_VISUAL_MAP[sport]?.ring ?? 'ring-primary/25';

interface SportIconProps {
  sport: SportCategory | string;
  className?: string;
  /** Render inside a soft circular badge */
  badge?: boolean;
  badgeSize?: 'sm' | 'md' | 'lg';
  active?: boolean;
  /** Add a subtle colored ring (premium look) */
  accent?: boolean;
}

const SportIcon = ({ sport, className, badge, badgeSize = 'md', active, accent }: SportIconProps) => {
  const Icon = getSportIcon(sport);
  if (!badge) {
    return <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />;
  }
  const sizeCls =
    badgeSize === 'lg' ? 'h-10 w-10' : badgeSize === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize =
    badgeSize === 'lg' ? 'h-5 w-5' : badgeSize === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const ring = accent ? `ring-1 ${getSportRing(sport)}` : '';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 transition-colors',
        sizeCls,
        active ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary',
        ring,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={iconSize} />
    </span>
  );
};

export default SportIcon;
