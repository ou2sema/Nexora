import { createBrowserRouter } from 'react-router';

import { AppShell } from '@/components/layout/app-shell';
import { CatalogSettingsPage } from '@/routes/catalog-settings-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { ProductsPage } from '@/routes/products-page';
import { SignInPage } from '@/routes/sign-in-page';
import { WarehousesPage } from '@/routes/warehouses-page';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'catalog', element: <CatalogSettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
