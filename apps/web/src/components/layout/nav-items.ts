import type { MessageKey } from '@/i18n/messages';

import {
  ArrowLeftRight,
  Boxes,
  BookOpen,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  Package,
  ReceiptText,
  Scale,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  Tags,
  UserRound,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  end?: boolean;
  platformAdminOnly?: boolean;
  requiresOrganization?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', labelKey: 'nav.products', icon: Package },
  { to: '/scan', labelKey: 'nav.scanning', icon: ScanLine },
  { to: '/sale', labelKey: 'nav.counterSale', icon: ReceiptText },
  { to: '/stock', labelKey: 'nav.stock', icon: Boxes, end: true },
  { to: '/stock/movements', labelKey: 'nav.movements', icon: ArrowLeftRight },
  { to: '/stock/reservations', labelKey: 'nav.reservations', icon: LockKeyhole },
  { to: '/devices', labelKey: 'nav.devices', icon: Smartphone },
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: Building2 },
  { to: '/purchasing', labelKey: 'nav.purchasing', icon: ClipboardList },
  { to: '/orders', labelKey: 'nav.orders', icon: Send },
  { to: '/customers', labelKey: 'nav.customers', icon: UserRound },
  { to: '/stock/reconciliation', labelKey: 'nav.reconciliation', icon: Scale },
  { to: '/warehouses', labelKey: 'nav.warehouses', icon: Warehouse },
  { to: '/catalog', labelKey: 'nav.catalog', icon: Tags },
  { to: '/guide', labelKey: 'nav.guide', icon: BookOpen, requiresOrganization: false },
  { to: '/team', labelKey: 'nav.team', icon: Users },
  {
    to: '/admin',
    labelKey: 'nav.admin',
    icon: ShieldCheck,
    platformAdminOnly: true,
    requiresOrganization: false,
  },
];
