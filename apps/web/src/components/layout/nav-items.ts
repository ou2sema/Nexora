import type { Workspace } from '@/features/organizations/permissions';
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
  /** Workspaces that need this screen. Omitted means every member. */
  workspaces?: readonly Workspace[];
}

const OWNER_ONLY: readonly Workspace[] = ['owner'];
const STAFF: readonly Workspace[] = ['owner', 'manager'];

export const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', labelKey: 'nav.products', icon: Package },
  { to: '/scan', labelKey: 'nav.scanning', icon: ScanLine },
  { to: '/sale', labelKey: 'nav.counterSale', icon: ReceiptText, workspaces: STAFF },
  { to: '/stock', labelKey: 'nav.stock', icon: Boxes, end: true },
  { to: '/stock/movements', labelKey: 'nav.movements', icon: ArrowLeftRight },
  {
    to: '/stock/reservations',
    labelKey: 'nav.reservations',
    icon: LockKeyhole,
    workspaces: STAFF,
  },
  { to: '/devices', labelKey: 'nav.devices', icon: Smartphone, workspaces: STAFF },
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: Building2, workspaces: STAFF },
  { to: '/purchasing', labelKey: 'nav.purchasing', icon: ClipboardList, workspaces: STAFF },
  { to: '/orders', labelKey: 'nav.orders', icon: Send, workspaces: STAFF },
  { to: '/customers', labelKey: 'nav.customers', icon: UserRound, workspaces: STAFF },
  {
    to: '/stock/reconciliation',
    labelKey: 'nav.reconciliation',
    icon: Scale,
    workspaces: OWNER_ONLY,
  },
  { to: '/warehouses', labelKey: 'nav.warehouses', icon: Warehouse, workspaces: OWNER_ONLY },
  { to: '/catalog', labelKey: 'nav.catalog', icon: Tags, workspaces: OWNER_ONLY },
  { to: '/guide', labelKey: 'nav.guide', icon: BookOpen, requiresOrganization: false },
  { to: '/team', labelKey: 'nav.team', icon: Users, workspaces: OWNER_ONLY },
  {
    to: '/admin',
    labelKey: 'nav.admin',
    icon: ShieldCheck,
    platformAdminOnly: true,
    requiresOrganization: false,
  },
];
