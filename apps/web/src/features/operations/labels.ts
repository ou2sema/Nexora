import type { PurchaseOrderStatus, SalesOrderStatus } from '@mystock/contracts';

import type { MessageKey } from '@/i18n/messages';

export const purchaseOrderStatusKeys: Record<PurchaseOrderStatus, MessageKey> = {
  draft: 'purchasing.status.draft',
  ordered: 'purchasing.status.ordered',
  partially_received: 'purchasing.status.partially_received',
  received: 'purchasing.status.received',
  cancelled: 'purchasing.status.cancelled',
};

export const purchaseOrderStatusStyles: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  ordered: 'bg-sky-50 text-sky-800 ring-sky-200',
  partially_received: 'bg-amber-50 text-amber-800 ring-amber-200',
  received: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export const salesOrderStatusKeys: Record<SalesOrderStatus, MessageKey> = {
  draft: 'sales.status.draft',
  confirmed: 'sales.status.confirmed',
  fulfilled: 'sales.status.fulfilled',
  cancelled: 'sales.status.cancelled',
};

export const salesOrderStatusStyles: Record<SalesOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  confirmed: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  fulfilled: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};
