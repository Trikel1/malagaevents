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
      className="fixed left-3 right-3 z-50 glass-nav bottom-nav-dock"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
      }}
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div
        className="bottom-nav-track max-w-lg mx-auto"
        style={{ ['--item-count' as any]: navItems.length } as React.CSSProperties}
      >
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'bottom-nav-item',
                isActive
                  ? 'bottom-nav-item-active'
                  : 'bottom-nav-item-idle'
              )}
              aria-label={item.label}
            >
              {isActive && <span className="bottom-nav-active-surface" aria-hidden />}
              <span className="bottom-nav-content">
                <span className="bottom-nav-icon-shell" aria-hidden>
                  <item.icon
                    className={cn(
                      'h-[22px] w-[22px] shrink-0 transition-[transform,stroke-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                      isActive && 'stroke-[2.35px] -translate-y-0.5'
                    )}
                  />
                </span>
                <span className="bottom-nav-label">
                  {item.label}
                </span>
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
