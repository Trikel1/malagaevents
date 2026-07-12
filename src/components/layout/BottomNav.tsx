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

  const activeIndex = useMemo(() => {
    const idx = navItems.findIndex(
      (item) =>
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(item.to))
    );
    return idx >= 0 ? idx : 0;
  }, [navItems, location.pathname]);

  const hasActive = navItems.some(
    (item) =>
      location.pathname === item.to ||
      (item.to !== '/' && location.pathname.startsWith(item.to))
  );

  return (
    <nav
      className="fixed left-2 right-2 z-50 glass-nav rounded-[28px] px-1.5 pt-1.5"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div
        className="relative flex justify-between max-w-lg mx-auto gap-0.5"
        style={
          {
            ['--item-count' as any]: navItems.length,
            ['--active-index' as any]: activeIndex,
          } as React.CSSProperties
        }
      >
        <span
          className="bottom-nav-liquid-indicator"
          style={{ opacity: hasActive ? 1 : 0 }}
          aria-hidden
        />
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'relative z-[1] flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-2xl min-h-[52px] select-none',
                'transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                'active:scale-[0.96]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={item.label}
            >
              <item.icon
                className={cn(
                  'h-[22px] w-[22px] shrink-0 transition-transform duration-300',
                  isActive && 'stroke-[2.4px] scale-110'
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[10.5px] leading-[1.1] font-medium truncate max-w-full transition-all duration-300',
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
