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
      className={
        isSportsHome
          ? 'min-h-screen relative bg-[hsl(174_22%_85%)] dark:bg-[hsl(190_32%_9%)]'
          : 'min-h-screen relative bg-background'
      }
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
