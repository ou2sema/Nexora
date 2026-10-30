import { LogOut, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { OrganizationSwitcher } from '@/features/organizations/organization-switcher';
import { LowStockBell } from '@/features/reports/low-stock-bell';

interface TopbarProps {
  onOpenNav: () => void;
}

export function Topbar({ onOpenNav }: TopbarProps) {
  const { session, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <OrganizationSwitcher />
      </div>

      <LowStockBell />

      <span className="hidden max-w-[14rem] truncate text-sm text-slate-600 md:block">
        {session?.user.email}
      </span>

      <Button
        variant="ghost"
        size="sm"
        aria-label="Sign out"
        onClick={() => {
          void signOut();
        }}
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </header>
  );
}
