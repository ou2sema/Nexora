import { z } from 'zod';

import { paymentMethodSchema } from '@mystock/contracts';

import type { MessageKey, MessageValues } from '@/i18n/messages';
import { parseAmountToMinor } from '@/lib/parse-amount';

type Translator = (key: MessageKey, values?: MessageValues) => string;

/**
 * What the counter still owns: where the sale leaves from and what the cash
 * drawer took. The amounts are not here — `app.create_sales_invoice` computes
 * them, and the preview only mirrors that to catch a mistake before posting.
 */
export function buildSaleSchema(t: Translator) {
  return z.object({
    warehouseId: z.string().min(1, t('common.selectWarehouse')),
    locationId: z.string().min(1, t('common.selectLocation')),
    paymentAmount: z
      .string()
      .trim()
      .refine((value) => value === '' || parseAmountToMinor(value) !== null, {
        message: t('sale.payment.invalid'),
      }),
    paymentMethod: paymentMethodSchema,
    reference: z.string().trim().max(120),
    notes: z.string().trim().max(2000),
  });
}

export type SaleValues = z.infer<ReturnType<typeof buildSaleSchema>>;

export const emptySale: SaleValues = {
  warehouseId: '',
  locationId: '',
  paymentAmount: '',
  paymentMethod: 'cash',
  reference: '',
  notes: '',
};
