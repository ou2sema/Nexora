import type { PurchaseOrderStatus, SalesOrderStatus } from '@mystock/contracts';

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const purchaseOrderStatusStyles: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  ordered: 'bg-sky-50 text-sky-800 ring-sky-200',
  partially_received: 'bg-amber-50 text-amber-800 ring-amber-200',
  received: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export const salesOrderStatusLabels: Record<SalesOrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export const salesOrderStatusStyles: Record<SalesOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  confirmed: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  fulfilled: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-800 ring-rose-200',
};
