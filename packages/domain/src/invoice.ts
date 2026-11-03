export interface InvoiceLineAmountInput {
  quantity: number;
  unitPriceMinor: number;
  taxRatePercent: number;
}

export interface InvoiceLineAmounts {
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface InvoiceTotals {
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
}

/**
 * The counter's preview of what `app.create_sales_invoice` computes: each line is
 * rounded to a whole millime before the invoice sums the rounded values, so the
 * screen shows exactly the HT + Taxes = TTC the printed invoice will carry.
 * The server recomputes every amount; nothing here is authoritative.
 */
export function invoiceLineAmounts({
  quantity,
  unitPriceMinor,
  taxRatePercent,
}: InvoiceLineAmountInput): InvoiceLineAmounts {
  const net = Math.round(quantity * unitPriceMinor);
  const tax = Math.round((net * taxRatePercent) / 100);
  return { netMinor: net, taxMinor: tax, totalMinor: net + tax };
}

export function invoiceTotals(lines: InvoiceLineAmounts[]): InvoiceTotals {
  return lines.reduce<InvoiceTotals>(
    (totals, line) => ({
      netMinor: totals.netMinor + line.netMinor,
      taxMinor: totals.taxMinor + line.taxMinor,
      totalMinor: totals.totalMinor + line.totalMinor,
    }),
    { netMinor: 0, taxMinor: 0, totalMinor: 0 },
  );
}
