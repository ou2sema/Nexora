import { createBrowserRouter } from 'react-router';

import { AppShell } from '@/components/layout/app-shell';
import { DashboardPage } from '@/routes/dashboard-page';
import { NotFoundPage } from '@/routes/not-found-page';
import { ProductsPage } from '@/routes/products-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
