import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Sparkles, Calendar, Map, User, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const TopNav = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // Stable desktop nav. Events and Sports are separate destinations.
  const navItems = useMemo(
    () => [
      { to: '/', icon: Home, label: t('nav.home'), end: true },
      { to: '/events', icon: Sparkles, label: t('nav.events'), end: false },
      { to: '/sports', icon: Trophy, label: t('nav.sports', 'Deportes'), end: false },
      { to: '/calendar', icon: Calendar, label: t('nav.calendar'), end: false },
      { to: '/map', icon: Map, label: t('nav.map', 'Mapa'), end: false },
      { to: '/profile', icon: User, label: t('nav.profile'), end: false },
    ],
    [t],
  );

  // On /sports and /venues, keep the Events tab visually inactive but flag
  // the Sports destination as current — provides continuity for users.
  const isCurrent = (to: string) => {
    const p = location.pathname;
    if (to === '/sports' && (p === '/venues' || p.startsWith('/venues'))) return true;
    if (to === '/') return p === '/';
    return p === to || p.startsWith(to + '/');
  };

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
          {navItems.map((item) => {
            const current = isCurrent(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  'inline-flex items-center gap-2 h-11 px-3 rounded-full text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  current
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
                aria-label={item.label}
                aria-current={current ? 'page' : undefined}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
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
