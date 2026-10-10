import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/80">
      {/* Sidebar — visible on md+ only */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar — shown on all screen sizes (different layouts per breakpoint) */}
        <TopBar />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8">
            <Outlet />
          </div>
        </main>

      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

    </div>
  );
}
