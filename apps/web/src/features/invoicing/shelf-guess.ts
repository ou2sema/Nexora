import type { StockLevelSummary } from '@mystock/contracts';

/** The pair an invoice issues from, as `app.create_sales_invoice` receives it. */
export interface SellingShelf {
  warehouseId: string;
  locationId: string;
}

export type ShelfGuess =
  { status: 'shelf'; shelf: SellingShelf } | { status: 'several' } | { status: 'unknown' };

function distinctShelves(levels: StockLevelSummary[]): SellingShelf[] {
  const seen = new Map<string, SellingShelf>();
  for (const level of levels) {
    const key = `${level.warehouseId}|${level.locationId}`;
    if (!seen.has(key)) {
      seen.set(key, { warehouseId: level.warehouseId, locationId: level.locationId });
    }
  }
  return [...seen.values()];
}

/**
 * What the stock of one product says about where a counter sale would leave from.
 *
 * Units another order has already reserved are not free for the counter, so shelves
 * with something available are considered first; only when every unit is reserved
 * does the answer fall back to where the goods physically are, which still names one
 * honest shelf instead of guessing. Two or more candidates is deliberately not
 * answered: the invoice leaves from one shelf, so the operator has to say which.
 */
export function guessShelf(levels: StockLevelSummary[]): ShelfGuess {
  const free = distinctShelves(levels.filter((level) => level.available > 0));
  if (free.length === 1) return { status: 'shelf', shelf: free[0]! };
  if (free.length > 1) return { status: 'several' };

  const stocked = distinctShelves(levels.filter((level) => level.onHand > 0));
  if (stocked.length === 1) return { status: 'shelf', shelf: stocked[0]! };
  if (stocked.length > 1) return { status: 'several' };

  return { status: 'unknown' };
}
