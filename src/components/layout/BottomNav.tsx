import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Calendar, Pill, User, Building2 } from 'lucide-react';
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
      base.push({ to: '/pharmacies', icon: Pill, label: t('nav.pharmacies') });
    }

    base.push({ to: '/profile', icon: User, label: t('nav.profile') });
    return base;
  }, [appMode, t]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-2 py-2 pb-safe">
      <div className="flex justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/' && location.pathname.startsWith(item.to));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
