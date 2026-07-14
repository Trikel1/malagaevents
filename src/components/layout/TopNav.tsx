import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Sparkles, Calendar, Map, User, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const TopNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const isCurrent = (to: string) => {
    const p = location.pathname;
    if (to === '/sports' && (p === '/venues' || p.startsWith('/venues'))) return true;
    if (to === '/') return p === '/';
    return p === to || p.startsWith(to + '/');
  };

  return (
    <header
      className={cn(
        'hidden lg:block sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled
          ? 'glass-nav border-b border-border/60'
          : 'bg-transparent border-b border-transparent',
      )}
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-8">
        <NavLink
          to="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label="Málaga Events"
        >
          <img
            src="/favicon.png"
            alt=""
            aria-hidden
            className="h-8 w-8 rounded-lg object-cover shadow-xs"
            loading="eager"
            decoding="async"
          />
          <span className="font-display text-[19px] font-bold tracking-tight text-foreground">
            Málaga Events
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
                  'inline-flex items-center gap-2 h-11 px-3.5 rounded-full text-[13.5px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  current
                    ? 'bg-primary/12 text-primary'
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
