import { createBrowserRouter } from 'react-router';

import { AppShell } from '@/components/layout/app-shell';
import { CatalogSettingsPage } from '@/routes/catalog-settings-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { DevicesPage } from '@/routes/devices-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { ProductsPage } from '@/routes/products-page';
import { PurchaseOrdersPage } from '@/routes/purchase-orders-page';
import { ReconciliationPage } from '@/routes/reconciliation-page';
import { ReservationsPage } from '@/routes/reservations-page';
import { SalesOrdersPage } from '@/routes/sales-orders-page';
import { ScanningPage } from '@/routes/scanning-page';
import { SignInPage } from '@/routes/sign-in-page';
import { StockLevelsPage } from '@/routes/stock-levels-page';
import { StockMovementsPage } from '@/routes/stock-movements-page';
import { SuppliersPage } from '@/routes/suppliers-page';
import { TeamPage } from '@/routes/team-page';
import { WarehousesPage } from '@/routes/warehouses-page';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'scan', element: <ScanningPage /> },
      { path: 'stock', element: <StockLevelsPage /> },
      { path: 'stock/movements', element: <StockMovementsPage /> },
      { path: 'stock/reservations', element: <ReservationsPage /> },
      { path: 'stock/reconciliation', element: <ReconciliationPage /> },
      { path: 'devices', element: <DevicesPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'purchasing', element: <PurchaseOrdersPage /> },
      { path: 'orders', element: <SalesOrdersPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'catalog', element: <CatalogSettingsPage /> },
      { path: 'team', element: <TeamPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
