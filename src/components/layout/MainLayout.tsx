import { Outlet } from 'react-router-dom';
import { useAppMode } from '@/contexts/AppModeContext';
import BottomNav from './BottomNav';

const MainLayout = () => {
  const { appMode } = useAppMode();

  return (
    <div className="min-h-screen bg-background" data-mode={appMode}>
      <main className="pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
