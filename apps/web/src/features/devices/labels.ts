import type { DeviceCondition, DeviceEventType, DeviceStatus } from '@mystock/contracts';

export const deviceStatusLabels: Record<DeviceStatus, string> = {
  in_stock: 'In stock',
  reserved: 'Reserved',
  sold: 'Sold',
  returned: 'Returned',
  in_repair: 'In repair',
  lost: 'Lost',
  disposed: 'Disposed',
};

export const deviceStatusStyles: Record<DeviceStatus, string> = {
  in_stock: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  reserved: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  sold: 'bg-slate-100 text-slate-700 ring-slate-200',
  returned: 'bg-sky-50 text-sky-800 ring-sky-200',
  in_repair: 'bg-amber-50 text-amber-800 ring-amber-200',
  lost: 'bg-rose-50 text-rose-800 ring-rose-200',
  disposed: 'bg-slate-200 text-slate-700 ring-slate-300',
};

export const deviceConditionLabels: Record<DeviceCondition, string> = {
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
  damaged: 'Damaged',
  defective: 'Defective',
};

export const deviceEventLabels: Record<DeviceEventType, string> = {
  registered: 'Registered',
  moved: 'Moved',
  reserved: 'Reserved',
  released: 'Released',
  issued: 'Issued',
  returned: 'Returned',
  repair_started: 'Repair started',
  repair_completed: 'Repair completed',
  marked_lost: 'Marked lost',
  disposed: 'Disposed',
  status_changed: 'Status changed',
};
