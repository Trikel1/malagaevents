import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import LanguageSelector from '@/components/common/LanguageSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAppMode } from '@/contexts/AppModeContext';

const HeroHeader = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { appMode, setAppMode } = useAppMode();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/events?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <header
      className={cn(
        'relative w-full text-white overflow-hidden',
        appMode === 'deportes' ? 'bg-gradient-hero-sports' : 'bg-gradient-hero'
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-[1180px] px-4 lg:px-8 pt-5 pb-14">
        {/* Top controls */}
        <div className="flex items-center justify-between gap-2 mb-7 min-w-0">
          <div className="glass-button relative flex p-0.5 min-w-0 shrink overflow-hidden">
            <span
              aria-hidden
              className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-card transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: 'calc(50% - 2px)',
                transform: `translateX(${appMode === 'eventos' ? '0%' : '100%'})`,
                boxShadow: '0 4px 14px -8px rgba(15,23,42,0.35)',
              }}
            />
            <button
              onClick={() => setAppMode('eventos')}
              aria-pressed={appMode === 'eventos'}
              className={cn(
                'relative z-[1] px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-200 min-h-[44px] whitespace-nowrap',
                appMode === 'eventos'
                  ? 'text-foreground'
                  : 'text-foreground/80 hover:text-foreground dark:text-white/85 dark:hover:text-white'
              )}
            >
              {t('sports.events')}
            </button>
            <button
              onClick={() => setAppMode('deportes')}
              aria-pressed={appMode === 'deportes'}
              className={cn(
                'relative z-[1] px-3 sm:px-4 py-1.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors duration-200 min-h-[44px] whitespace-nowrap',
                appMode === 'deportes'
                  ? 'text-foreground'
                  : 'text-foreground/80 hover:text-foreground dark:text-white/85 dark:hover:text-white'
              )}
            >
              {t('sports.title')}
            </button>
          </div>

          {/* On desktop the language/theme controls live in TopNav; hide here. */}
          <div className="flex items-center gap-1 shrink-0 lg:hidden">
            <ThemeToggle />
            <LanguageSelector variant="compact" />
          </div>
        </div>

        {/* Editorial title */}
        <div className="relative">
          <h1 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.02] font-semibold tracking-tight max-w-2xl">
            {t('home.hero.title')}
          </h1>
          <p className="text-[15px] sm:text-base lg:text-lg text-white/90 mt-3 max-w-xl leading-relaxed">
            {t('home.hero.subtitle')}
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative mt-5 max-w-2xl" role="search">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" aria-hidden="true" />
          <label htmlFor="home-search" className="sr-only">{t('home.hero.searchAria')}</label>
          <Input
            id="home-search"
            type="search"
            placeholder={t('home.hero.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 bg-card text-foreground border border-border/70 shadow-card focus-visible:ring-2 focus-visible:ring-white/70 placeholder:text-muted-foreground"
          />
        </form>
      </div>
    </header>
  );
};

export default HeroHeader;
