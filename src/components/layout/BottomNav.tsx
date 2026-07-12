import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Calendar, Map, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

const BottomNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { appMode } = useAppMode();

  const navItems = useMemo(() => {
    const base = [
      { to: '/', icon: Home, label: t('nav.home') },
      { to: '/events', icon: CalendarDays, label: t('nav.events') },
      { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    ];

    if (appMode === 'deportes') {
      base.push({ to: '/venues', icon: Building2, label: t('nav.venues') });
    } else {
      base.push({ to: '/map', icon: Map, label: t('nav.map', 'Mapa') });
    }

    base.push({ to: '/profile', icon: User, label: t('nav.profile') });
    return base;
  }, [appMode, t]);

  return (
    <nav
      className="fixed left-2 right-2 z-50 glass-nav rounded-[28px] px-1.5 pt-1.5"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div className="flex justify-between max-w-lg mx-auto gap-0.5">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-2xl min-h-[52px] transition-all duration-200 select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                'active:scale-[0.96]',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-label={item.label}
            >
              <item.icon
                className={cn(
                  'h-[22px] w-[22px] shrink-0 transition-transform',
                  isActive && 'stroke-[2.4px] scale-110'
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[10.5px] leading-[1.1] font-medium truncate max-w-full',
                  isActive && 'font-semibold'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
