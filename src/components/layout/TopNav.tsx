import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { Home, Sparkles, Calendar, Map, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const TopNav = () => {
  const { t } = useTranslation();
  const { appMode } = useAppMode();

  const navItems = useMemo(() => {
    const base = [
      { to: '/', icon: Home, label: t('nav.home'), end: true },
      { to: '/events', icon: Sparkles, label: t('nav.events') },
      { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    ];
    if (appMode === 'deportes') {
      base.push({ to: '/venues', icon: Building2, label: t('nav.venues'), end: false });
    } else {
      base.push({ to: '/map', icon: Map, label: t('nav.map', 'Mapa'), end: false });
    }
    base.push({ to: '/profile', icon: User, label: t('nav.profile'), end: false });
    return base;
  }, [appMode, t]);

  return (
    <header
      className="hidden lg:block sticky top-0 z-40 glass-nav border-b border-border/60"
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-6 px-6">
        <NavLink to="/" className="flex items-baseline gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Málaga
          </span>
          <span className="hidden xl:inline text-sm text-muted-foreground">
            {t('home.hero.subtitle')}
          </span>
        </NavLink>

        <nav className="flex items-center gap-1" aria-label={t('nav.primary', 'Navegación principal')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 h-11 px-3 rounded-full text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )
              }
              aria-label={item.label}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle variant="nav" />
          <LanguageSelector variant="compact" />
        </div>
      </div>
    </header>
  );
};

export default TopNav;
