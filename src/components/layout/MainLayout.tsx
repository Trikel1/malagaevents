import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default MainLayout;
