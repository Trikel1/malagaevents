import {
  CircleDot,
  Trophy,
  Footprints,
  Bike,
  Waves,
  Car,
  Hand,
  Award,
  Dribbble,
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

interface SportVisual {
  Icon: LucideIcon;
  /** Subtle ring color used only in premium badge mode */
  ring: string;
}

/**
 * Static visual map. Keys cover canonical SportCategory values + common aliases
 * present in real scraped data (running, padel, ciclismo, natacion, triatlon…).
 * No dynamic Tailwind class composition — every class is a literal string.
 */
export const SPORT_VISUAL_MAP: Record<string, SportVisual> = {
  futbol: { Icon: CircleDot, ring: 'ring-emerald-500/25' },
  futsal: { Icon: CircleDot, ring: 'ring-emerald-500/25' },
  baloncesto: { Icon: Dribbble, ring: 'ring-orange-500/25' },
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

export const getSportIcon = (sport: string): LucideIcon =>
  SPORT_VISUAL_MAP[sport]?.Icon ?? Award;

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
  const ring = accent ? `ring-2 ${getSportRing(sport)}` : '';
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
