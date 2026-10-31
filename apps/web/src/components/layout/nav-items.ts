import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Scale,
  ScanLine,
  Send,
  Smartphone,
  Tags,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/scan', label: 'Scanning', icon: ScanLine },
  { to: '/stock', label: 'Stock levels', icon: Boxes, end: true },
  { to: '/stock/movements', label: 'Movements', icon: ArrowLeftRight },
  { to: '/stock/reservations', label: 'Reservations', icon: LockKeyhole },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/suppliers', label: 'Suppliers', icon: Building2 },
  { to: '/purchasing', label: 'Purchase orders', icon: ClipboardList },
  { to: '/orders', label: 'Outgoing orders', icon: Send },
  { to: '/stock/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/warehouses', label: 'Warehouses', icon: Warehouse },
  { to: '/catalog', label: 'Catalog settings', icon: Tags },
];
