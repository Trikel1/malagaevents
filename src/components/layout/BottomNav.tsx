import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Calendar, Map, Pill, User, Building2 } from 'lucide-react';
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
    <nav className="fixed bottom-3 left-3 right-3 z-50 glass-nav rounded-3xl px-2 py-1.5 pb-safe">
      <div className="flex justify-around max-w-lg mx-auto">

        {navItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl min-w-[56px] min-h-[48px] transition-all duration-200',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <item.icon className={cn('h-5 w-5 transition-transform', isActive && 'stroke-[2.5px] scale-110')} />
              <span className={cn('text-[11px] font-medium leading-tight', isActive && 'font-semibold')}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
