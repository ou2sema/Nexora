import type { DeviceSummary, InvoiceLineInput, ProductSummary } from '@mystock/contracts';
import {
  invoiceLineAmounts,
  invoiceTotals,
  type InvoiceLineAmounts,
  type InvoiceTotals,
} from '@mystock/domain';

import {
  formatMinorAsInput,
  parseAmountToMinor,
  parsePercent,
  parseQuantity,
} from '@/lib/parse-amount';

/** How a line entered the basket, so the screen can explain an unexpected duplicate. */
export type BasketOrigin = 'usb' | 'camera' | 'manual' | 'search' | 'picker';

export interface BasketProductLine {
  kind: 'product';
  key: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: string;
  /** Operator override; blank leaves the line to the catalogue price. */
  unitPrice: string;
  /** The catalogue sale price, used only to preview what the server will compute. */
  catalogPriceMinor: number | null;
  taxRate: string;
  origin: BasketOrigin;
}

export interface BasketDeviceLine {
  kind: 'device';
  key: string;
  deviceId: string;
  productId: string;
  sku: string;
  productName: string;
  serialNumber: string;
  unitPrice: string;
  catalogPriceMinor: number | null;
  taxRate: string;
  origin: BasketOrigin;
}

export type BasketLine = BasketProductLine | BasketDeviceLine;

/** The three fields the operator can still edit after a line is in the basket. */
export type BasketLinePatch = Partial<
  Pick<BasketProductLine, 'quantity' | 'unitPrice' | 'taxRate'>
>;

export type BasketProblemReason = 'quantity' | 'price' | 'tax';

export interface BasketProblem {
  key: string | null;
  reason: BasketProblemReason | 'empty';
}

const productKey = (productId: string) => `product:${productId}`;
const deviceKey = (deviceId: string) => `device:${deviceId}`;

const ZERO_TOTALS: InvoiceTotals = { netMinor: 0, taxMinor: 0, totalMinor: 0 };

/** Units added to a line that already exists; an unreadable quantity restarts at the scanned amount. */
function mergeQuantity(current: string, added: number): string {
  const parsed = parseQuantity(current);
  const next = (parsed === null ? 0 : parsed) + added;
  return String(Math.round(next * 10_000) / 10_000);
}

export function findLine(lines: BasketLine[], key: string): BasketLine | undefined {
  return lines.find((line) => line.key === key);
}

/** The line a product code would add to, which is what the confirm dialog reports. */
export function findProductLine(
  lines: BasketLine[],
  productId: string,
): BasketProductLine | undefined {
  return lines.find(
    (line): line is BasketProductLine => line.kind === 'product' && line.productId === productId,
  );
}

/**
 * A product scan adds units to the matching line, which is what a depot operator
 * expects when the same carton barcode is read twice; the confirm dialog decides
 * how many. A serialized product never becomes a quantity line — the caller
 * resolves it to a device.
 */
export function addProduct(
  lines: BasketLine[],
  product: ProductSummary,
  options: { taxRate: string; origin: BasketOrigin; quantity?: number },
): BasketLine[] {
  const key = productKey(product.id);
  const existing = findLine(lines, key);
  const added = options.quantity ?? 1;

  if (existing && existing.kind === 'product') {
    return lines.map((line) =>
      line.key === key && line.kind === 'product'
        ? { ...line, quantity: mergeQuantity(line.quantity, added) }
        : line,
    );
  }

  return [
    ...lines,
    {
      kind: 'product',
      key,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: String(added),
      unitPrice: '',
      catalogPriceMinor: product.salePriceMinor,
      taxRate: options.taxRate,
      origin: options.origin,
    },
  ];
}

/** A serialized unit is sold one at a time, so the device itself is the line. */
export function addDevice(
  lines: BasketLine[],
  device: DeviceSummary,
  product: ProductSummary | undefined,
  options: { taxRate: string; origin: BasketOrigin },
): BasketLine[] {
  const key = deviceKey(device.id);
  if (findLine(lines, key)) return lines;

  return [
    ...lines,
    {
      kind: 'device',
      key,
      deviceId: device.id,
      productId: device.productId,
      sku: device.productSku,
      productName: device.productName,
      serialNumber: device.serialNumber,
      unitPrice: '',
      catalogPriceMinor: product?.salePriceMinor ?? null,
      taxRate: options.taxRate,
      origin: options.origin,
    },
  ];
}

export function updateLine(lines: BasketLine[], key: string, patch: BasketLinePatch): BasketLine[] {
  return lines.map((line) => (line.key === key ? { ...line, ...patch } : line));
}

export function removeLine(lines: BasketLine[], key: string): BasketLine[] {
  return lines.filter((line) => line.key !== key);
}

/** The price the RPC will use: the operator's override, else the catalogue sale price. */
export function effectivePriceMinor(line: BasketLine): number | null {
  return parseAmountToMinor(line.unitPrice) ?? line.catalogPriceMinor;
}

export function pricePlaceholder(line: BasketLine): string {
  return line.catalogPriceMinor === null ? '' : formatMinorAsInput(line.catalogPriceMinor);
}

export interface BasketPreview {
  lineAmounts: Record<string, InvoiceLineAmounts>;
  totals: InvoiceTotals;
  /** Units the invoice would move; a device line is one unit. */
  totalQuantity: number;
  problems: BasketProblem[];
  /** The basket is worth posting: at least one line and every line computable. */
  ready: boolean;
}

/**
 * Mirrors `app.create_sales_invoice` line by line so the counter shows the same
 * millimes the printed invoice will carry. Nothing computed here is sent as an
 * amount — only quantities, rates and the price override travel to the server.
 */
export function previewBasket(lines: BasketLine[]): BasketPreview {
  const lineAmounts: Record<string, InvoiceLineAmounts> = {};
  const amounts: InvoiceLineAmounts[] = [];
  const problems: BasketProblem[] = [];
  let totalQuantity = 0;

  for (const line of lines) {
    const quantity = line.kind === 'device' ? 1 : parseQuantity(line.quantity);
    if (quantity === null) {
      problems.push({ key: line.key, reason: 'quantity' });
      continue;
    }

    const unitPriceMinor = effectivePriceMinor(line);
    if (unitPriceMinor === null) {
      problems.push({ key: line.key, reason: 'price' });
      continue;
    }

    const taxRatePercent = line.taxRate.trim() === '' ? 0 : parsePercent(line.taxRate);
    if (taxRatePercent === null) {
      problems.push({ key: line.key, reason: 'tax' });
      continue;
    }

    const computed = invoiceLineAmounts({ quantity, unitPriceMinor, taxRatePercent });
    lineAmounts[line.key] = computed;
    amounts.push(computed);
    totalQuantity += quantity;
  }

  if (lines.length === 0) problems.push({ key: null, reason: 'empty' });

  return {
    lineAmounts,
    totals: amounts.length > 0 ? invoiceTotals(amounts) : ZERO_TOTALS,
    totalQuantity: Math.round(totalQuantity * 10_000) / 10_000,
    problems,
    ready: lines.length > 0 && problems.length === 0,
  };
}

/** The basket as the RPC expects it, leaving unset fields out so the server resolves them. */
export function toInvoiceLines(lines: BasketLine[]): InvoiceLineInput[] {
  return lines.map((line) => {
    const override = parseAmountToMinor(line.unitPrice);
    const taxRate = parsePercent(line.taxRate);

    return line.kind === 'product'
      ? {
          kind: 'product',
          productId: line.productId,
          quantity: parseQuantity(line.quantity) ?? 1,
          unitPriceMinor: override,
          taxRatePercent: taxRate,
        }
      : {
          kind: 'device',
          deviceId: line.deviceId,
          unitPriceMinor: override,
          taxRatePercent: taxRate,
        };
  });
}
