import { Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAppMode } from '@/contexts/AppModeContext';
import BottomNav from './BottomNav';
import LiquidGlassBackdrop from './LiquidGlassBackdrop';

const routeKeyFromPath = (pathname: string): string => {
  if (pathname === '/' || pathname === '') return 'home';
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'home';
  return seg;
};

const MainLayout = () => {
  const { appMode } = useAppMode();
  const location = useLocation();
  const routeKey = useMemo(() => routeKeyFromPath(location.pathname), [location.pathname]);

  /**
   * Routes that belong to the (independent) Deportes module. Shared routes
   * such as /map, /calendar or /pharmacies keep the global theme untouched.
   */
  const SPORTS_ROUTES = ['home', 'events', 'venues'];
  const isSportsSection = appMode === 'deportes' && SPORTS_ROUTES.includes(routeKey);

  return (
    <div
      className={cn(
        'min-h-screen relative',
        isSportsSection ? 'sports-theme bg-background' : 'bg-background',
      )}
      data-mode={appMode}
      data-route={routeKey}
    >

      <LiquidGlassBackdrop />
      <main
        className="relative z-[1]"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        }}
      >
        <div key={routeKey} className="liquid-page-shell">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
};




export default MainLayout;
