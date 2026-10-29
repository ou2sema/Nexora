import { useState } from 'react';
import { Outlet } from 'react-router';

import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <Sidebar className="fixed inset-y-0 left-0 hidden w-64 lg:flex" />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="lg:pl-64">
        <Topbar onOpenNav={() => setMobileNavOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
