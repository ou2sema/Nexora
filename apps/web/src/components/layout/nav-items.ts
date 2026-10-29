import {
  ArrowLeftRight,
  Boxes,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Scale,
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
  { to: '/stock', label: 'Stock levels', icon: Boxes, end: true },
  { to: '/stock/movements', label: 'Movements', icon: ArrowLeftRight },
  { to: '/stock/reservations', label: 'Reservations', icon: LockKeyhole },
  { to: '/devices', label: 'Devices', icon: Smartphone },
  { to: '/stock/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/warehouses', label: 'Warehouses', icon: Warehouse },
  { to: '/catalog', label: 'Catalog settings', icon: Tags },
];
