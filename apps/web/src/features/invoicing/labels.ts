import type { PaymentMethod, PaymentStatus } from '@mystock/contracts';

import type { MessageKey } from '@/i18n/messages';

export const paymentStatusKeys: Record<PaymentStatus, MessageKey> = {
  unpaid: 'invoice.paymentStatus.unpaid',
  partial: 'invoice.paymentStatus.partial',
  paid: 'invoice.paymentStatus.paid',
};

export const paymentStatusStyles: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-50 text-rose-800 ring-rose-200',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

/**
 * The only four ways a depot settles a counter sale. Nothing about the
 * instrument is captured: `card_manual` is a terminal slip keyed by hand.
 */
export const paymentMethodKeys: Record<PaymentMethod, MessageKey> = {
  cash: 'invoice.method.cash',
  bank_transfer: 'invoice.method.bank_transfer',
  card_manual: 'invoice.method.card_manual',
  credit: 'invoice.method.credit',
};
