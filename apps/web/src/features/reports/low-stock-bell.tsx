import { Bell } from 'lucide-react';
import { Link } from 'react-router';

import { useOrganization } from '@/features/organizations/organization-provider';
import { useLowStock } from './api';

export function LowStockBell() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const lowStock = useLowStock(organizationId, {
    warehouseId: '',
    categoryId: '',
    page: 1,
    pageSize: 1,
  });
  const count = lowStock.data?.total ?? 0;
  const label =
    count === 0
      ? 'Low stock alerts: none'
      : `Low stock alerts: ${count} product${count === 1 ? '' : 's'}`;

  return (
    <Link
      to="/#low-stock"
      aria-label={label}
      title={label}
      className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
    >
      <Bell aria-hidden="true" className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[0.65rem] font-semibold leading-5 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
