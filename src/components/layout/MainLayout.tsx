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

  const isSportsHome = appMode === 'deportes' && (location.pathname === '/' || location.pathname === '');

  return (
    <div
      className="min-h-screen relative"
      data-mode={appMode}
      data-route={routeKey}
      style={
        isSportsHome
          ? {
              // Opaque mediterranean teal so the safe-area/nav strip never
              // reveals a white band at the bottom of the sports landing.
              background: 'hsl(168 28% 92%)',
            }
          : undefined
      }
    >
      {/* Dark-mode override for the sports landing background */}
      {isSportsHome && (
        <style>{`.dark [data-mode="deportes"][data-route="home"]{background:hsl(190 32% 9%)!important}`}</style>
      )}
      {!isSportsHome && <div aria-hidden className="absolute inset-0 bg-background -z-10" />}
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
