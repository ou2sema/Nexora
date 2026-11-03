import { createBrowserRouter } from 'react-router';

import { AppShell } from '@/components/layout/app-shell';

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    lazy: async () => ({ Component: (await import('@/routes/sign-in-page')).SignInPage }),
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/routes/dashboard-page')).DashboardPage }),
      },
      {
        path: 'products',
        lazy: async () => ({ Component: (await import('@/routes/products-page')).ProductsPage }),
      },
      {
        path: 'scan',
        lazy: async () => ({ Component: (await import('@/routes/scanning-page')).ScanningPage }),
      },
      {
        path: 'sale',
        lazy: async () => ({
          Component: (await import('@/routes/counter-sale-page')).CounterSalePage,
        }),
      },
      {
        path: 'stock',
        lazy: async () => ({
          Component: (await import('@/routes/stock-levels-page')).StockLevelsPage,
        }),
      },
      {
        path: 'stock/movements',
        lazy: async () => ({
          Component: (await import('@/routes/stock-movements-page')).StockMovementsPage,
        }),
      },
      {
        path: 'stock/reservations',
        lazy: async () => ({
          Component: (await import('@/routes/reservations-page')).ReservationsPage,
        }),
      },
      {
        path: 'stock/reconciliation',
        lazy: async () => ({
          Component: (await import('@/routes/reconciliation-page')).ReconciliationPage,
        }),
      },
      {
        path: 'devices',
        lazy: async () => ({ Component: (await import('@/routes/devices-page')).DevicesPage }),
      },
      {
        path: 'suppliers',
        lazy: async () => ({ Component: (await import('@/routes/suppliers-page')).SuppliersPage }),
      },
      {
        path: 'purchasing',
        lazy: async () => ({
          Component: (await import('@/routes/purchase-orders-page')).PurchaseOrdersPage,
        }),
      },
      {
        path: 'orders',
        lazy: async () => ({
          Component: (await import('@/routes/sales-orders-page')).SalesOrdersPage,
        }),
      },
      {
        path: 'customers',
        lazy: async () => ({ Component: (await import('@/routes/customers-page')).CustomersPage }),
      },
      {
        path: 'warehouses',
        lazy: async () => ({
          Component: (await import('@/routes/warehouses-page')).WarehousesPage,
        }),
      },
      {
        path: 'catalog',
        lazy: async () => ({
          Component: (await import('@/routes/catalog-settings-page')).CatalogSettingsPage,
        }),
      },
      {
        path: 'team',
        lazy: async () => ({ Component: (await import('@/routes/team-page')).TeamPage }),
      },
      {
        path: 'admin',
        lazy: async () => ({ Component: (await import('@/routes/admin-page')).AdminPage }),
      },
      {
        path: 'admin/organizations/:organizationId/team',
        lazy: async () => ({ Component: (await import('@/routes/admin-team-page')).AdminTeamPage }),
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/routes/not-found-page')).NotFoundPage }),
      },
    ],
  },
]);
