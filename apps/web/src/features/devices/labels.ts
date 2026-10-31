import type { DeviceCondition, DeviceEventType, DeviceStatus } from '@mystock/contracts';

import type { MessageKey } from '@/i18n/messages';

export const deviceStatusKeys: Record<DeviceStatus, MessageKey> = {
  in_stock: 'devices.status.inStock',
  reserved: 'devices.status.reserved',
  sold: 'devices.status.sold',
  returned: 'devices.status.returned',
  in_repair: 'devices.status.inRepair',
  lost: 'devices.status.lost',
  disposed: 'devices.status.disposed',
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

export const deviceConditionKeys: Record<DeviceCondition, MessageKey> = {
  new: 'devices.condition.new',
  used: 'devices.condition.used',
  refurbished: 'devices.condition.refurbished',
  damaged: 'devices.condition.damaged',
  defective: 'devices.condition.defective',
};

export const deviceEventKeys: Record<DeviceEventType, MessageKey> = {
  registered: 'devices.event.registered',
  moved: 'devices.event.moved',
  reserved: 'devices.event.reserved',
  released: 'devices.event.released',
  issued: 'devices.event.issued',
  returned: 'devices.event.returned',
  repair_started: 'devices.event.repairStarted',
  repair_completed: 'devices.event.repairCompleted',
  marked_lost: 'devices.event.markedLost',
  disposed: 'devices.event.disposed',
  status_changed: 'devices.event.statusChanged',
};
