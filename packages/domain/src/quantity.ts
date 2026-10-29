export const QUANTITY_DECIMALS = 4;

const SCALE = 10 ** QUANTITY_DECIMALS;

export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Quantity must be a finite number, received ${String(value)}`);
  }
  return Math.round((value + Number.EPSILON) * SCALE) / SCALE;
}

export interface StockSnapshot {
  onHand: number;
  reserved: number;
}

/**
 * Available stock = physical on-hand minus units reserved by outgoing orders.
 * In-transit stock is tracked separately and is never part of this figure.
 */
export function availableQuantity({ onHand, reserved }: StockSnapshot): number {
  return roundQuantity(onHand - reserved);
}

export function isReservationFeasible(
  { onHand, reserved }: StockSnapshot,
  requested: number,
): boolean {
  if (requested <= 0) {
    throw new Error('Reservation quantity must be strictly positive');
  }
  return roundQuantity(availableQuantity({ onHand, reserved }) - requested) >= 0;
}
