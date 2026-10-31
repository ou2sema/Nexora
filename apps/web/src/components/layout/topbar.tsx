import { LogOut, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import { useOrganization } from '@/features/organizations/organization-provider';
import { OrganizationSwitcher } from '@/features/organizations/organization-switcher';
import { LowStockBell } from '@/features/reports/low-stock-bell';
import { useI18n } from '@/i18n/provider';
import { LanguageSwitcher } from './language-switcher';

interface TopbarProps {
  onOpenNav: () => void;
}

export function Topbar({ onOpenNav }: TopbarProps) {
  const { session, signOut } = useAuth();
  const { platformAdmin } = useOrganization();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={t('common.openNavigation')}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <OrganizationSwitcher />
      </div>

      <LanguageSwitcher />
      <LowStockBell />

      {platformAdmin && (
        <span className="hidden rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200 sm:inline">
          {t('common.platformAdmin')}
        </span>
      )}

      <span dir="ltr" className="hidden max-w-[14rem] truncate text-sm text-slate-600 md:block">
        {session?.user.email}
      </span>

      <Button
        variant="ghost"
        size="sm"
        aria-label={t('common.signOut')}
        onClick={() => {
          void signOut();
        }}
      >
        <LogOut aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        <span className="hidden sm:inline">{t('common.signOut')}</span>
      </Button>
    </header>
  );
}
