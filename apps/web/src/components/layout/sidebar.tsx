import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';

import { BrandMark } from '@/components/brand-mark';
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
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const hasOrganization = memberships.length > 0;
  const items = navItems.filter(
    (item) =>
      (!item.platformAdminOnly || platformAdmin) &&
      (hasOrganization || item.requiresOrganization === false),
  );

  // A deep route should not leave its own highlight hidden below the scroll.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname, items.length]);

  return (
    <div className={cn('flex h-full flex-col bg-ink-950 text-slate-300', className)}>
      <div className="flex h-16 shrink-0 items-center gap-3 px-5">
        <BrandMark textClassName="text-base text-white" />
      </div>

      {/* The list is taller than a laptop viewport, so it owns its own scroll. */}
      <nav
        ref={navRef}
        aria-label={t('nav.main')}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [color-scheme:dark]"
      >
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
    </div>
  );
}
