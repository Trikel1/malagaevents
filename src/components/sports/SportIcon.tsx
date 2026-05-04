import {
  CircleDot,
  Trophy,
  Activity,
  Car,
  Hand,
  Award,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SportCategory } from '@/types/sports';

export const SPORT_ICON_MAP: Record<SportCategory, LucideIcon> = {
  futbol: CircleDot,
  baloncesto: CircleDot,
  futsal: CircleDot,
  balonmano: Hand,
  atletismo: Activity,
  motor: Car,
  tenis: Trophy,
  otros: Award,
};

interface SportIconProps {
  sport: SportCategory | string;
  className?: string;
  /** Render inside a soft circular badge */
  badge?: boolean;
  badgeSize?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const getSportIcon = (sport: string): LucideIcon =>
  SPORT_ICON_MAP[sport as SportCategory] || Award;

const SportIcon = ({ sport, className, badge, badgeSize = 'md', active }: SportIconProps) => {
  const Icon = getSportIcon(sport);
  if (!badge) {
    return <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />;
  }
  const sizeCls =
    badgeSize === 'lg' ? 'h-10 w-10' : badgeSize === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize =
    badgeSize === 'lg' ? 'h-5 w-5' : badgeSize === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 transition-colors',
        sizeCls,
        active ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={iconSize} />
    </span>
  );
};

export default SportIcon;
