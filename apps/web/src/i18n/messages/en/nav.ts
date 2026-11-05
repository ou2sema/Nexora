export const nav = {
  'nav.dashboard': 'Dashboard',
  'nav.products': 'Products',
  'nav.scanning': 'Scanning',
  'nav.counterSale': 'Counter sale',
  'nav.stock': 'Stock levels',
  'nav.movements': 'Movements',
  'nav.reservations': 'Reservations',
  'nav.devices': 'Devices',
  'nav.suppliers': 'Suppliers',
  'nav.purchasing': 'Purchase orders',
  'nav.orders': 'Outgoing orders',
  'nav.customers': 'Customers',
  'nav.reconciliation': 'Reconciliation',
  'nav.warehouses': 'Warehouses',
  'nav.catalog': 'Catalog settings',
  'nav.team': 'Team',
  'nav.admin': 'Administration',
  'nav.guide': 'Guide',
  'nav.main': 'Main navigation',
} as const;

export type NavMessages = Record<keyof typeof nav, string>;
