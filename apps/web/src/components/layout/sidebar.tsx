import { Boxes } from 'lucide-react';
import { NavLink } from 'react-router';

import { navItems } from '@/components/layout/nav-items';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { memberships, platformAdmin } = useOrganization();
  const { t } = useI18n();
  const hasOrganization = memberships.length > 0;
  const items = navItems.filter(
    (item) =>
      (!item.platformAdminOnly || platformAdmin) &&
      (hasOrganization || item.requiresOrganization === false),
  );

  return (
    <div className={cn('flex h-full flex-col bg-ink-950 text-slate-300', className)}>
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="grid size-9 place-items-center rounded-xl bg-indigo-500 text-white">
          <Boxes aria-hidden="true" className="size-5" />
        </span>
        <span className="text-base font-semibold tracking-tight text-white">Mystock</span>
      </div>

      <nav aria-label={t('nav.main')} className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <item.icon aria-hidden="true" className="size-4" />
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-500">
        {t('layout.footer')}
      </div>
    </div>
  );
}
