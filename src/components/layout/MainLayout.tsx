import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppMode } from '@/contexts/AppModeContext';
import { cn } from '@/lib/utils';

import BottomNav from './BottomNav';
import LiquidGlassBackdrop from './LiquidGlassBackdrop';

const routeKeyFromPath = (pathname: string): string => {
  if (pathname === '/' || pathname === '') return 'home';
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'home';
  return seg;
};

const MainLayout = () => {
  const { appMode } = useAppMode();
  const { t } = useTranslation();
  const location = useLocation();
  const routeKey = useMemo(() => routeKeyFromPath(location.pathname), [location.pathname]);

  /**
   * Routes that belong to the (independent) Deportes module. Shared routes
   * such as /map, /calendar or /pharmacies keep the global theme untouched.
   */
  const SPORTS_ROUTES = ['home', 'events', 'venues'];
  const isSportsSection = appMode === 'deportes' && SPORTS_ROUTES.includes(routeKey);

  // Route-change focus management: move focus to the top of the new page so
  // screen-reader and keyboard users are not left at the bottom nav. Skipped on
  // first paint (never steal focus on entry) and while a dialog is open.
  const contentRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
    contentRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div
      className={cn(
        'min-h-screen relative',
        isSportsSection ? 'sports-theme bg-background' : 'bg-background',
      )}
      data-mode={appMode}
      data-route={routeKey}
    >
      <a href="#contenido-principal" className="skip-to-content">
        {t('a11y.skipToContent', 'Ir al contenido principal')}
      </a>

      <LiquidGlassBackdrop />
      {/* Pages render their own <main>; this wrapper must not create a second
          main landmark. */}
      <div
        id="contenido-principal"
        ref={contentRef}
        tabIndex={-1}
        className="relative z-[1] outline-none"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)',
        }}
      >
        <div key={routeKey} className="liquid-page-shell">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
