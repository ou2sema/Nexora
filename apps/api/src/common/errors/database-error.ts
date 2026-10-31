import type { ErrorDescriptor } from '../filters/all-exceptions.filter';

interface PostgresErrorLike {
  code?: unknown;
  severity?: unknown;
  constraint?: unknown;
  message?: unknown;
}

function isPostgresError(value: unknown): value is PostgresErrorLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as PostgresErrorLike;
  return typeof candidate.code === 'string' && typeof candidate.severity === 'string';
}

const CONSTRAINT_MESSAGES: Record<string, string> = {
  category_cycle: 'A category cannot be its own ancestor.',
  organization_requires_owner: 'An organization must keep at least one owner.',
  insufficient_stock: 'Not enough stock available for this movement.',
  stock_reserved: 'The requested quantity is reserved for an outgoing order.',
  reservation_not_active: 'The reservation is no longer active.',
  reservation_mismatch: 'The reservation does not match this issue.',
  reservation_already_fulfilled: 'The reservation was already fulfilled.',
  stock_count_already_open: 'An open count already exists for this stock location.',
  stock_count_not_open: 'This stock count is no longer open.',
  stock_count_empty: 'Record at least one line before posting the count.',
  stock_count_below_reserved: 'The counted quantity is below the reserved quantity.',
  product_not_countable: 'Serialized products are tracked per device, not by quantity.',
  supplier_inactive: 'This supplier is inactive.',
  product_serialized_order_unsupported:
    'Serialized products are issued per device, not through an order line.',
  purchase_order_over_receipt: 'The received quantity exceeds the ordered quantity.',
  purchase_order_not_receivable: 'Only ordered purchase orders can receive stock.',
  purchase_order_not_cancellable: 'A purchase order that received stock cannot be cancelled.',
  purchase_order_not_draft: 'Only draft purchase orders can be ordered.',
  sales_order_not_draft: 'Only draft outgoing orders can be confirmed.',
  sales_order_not_fulfillable: 'Only confirmed outgoing orders can be fulfilled.',
  sales_order_not_cancellable: 'Only draft or confirmed outgoing orders can be cancelled.',
  sales_order_reservation_missing: 'This outgoing order is missing its stock reservation.',
  serial_count_mismatch: 'Provide one serial number per received unit.',
  serial_numbers_not_supported: 'This product is not serialized; remove the serial numbers.',
};

const VALIDATION_MESSAGES: Record<string, string> = {
  order_requires_lines: 'Add at least one line.',
  order_too_many_lines: 'An order can have at most 100 lines.',
  order_line_invalid: 'Each line needs a product and a positive quantity.',
  duplicate_order_line: 'Each product may appear only once.',
  customer_name_required: 'Enter the customer name.',
  invalid_supplier_name: 'Enter a supplier name.',
  invalid_country_code: 'Use a two-letter country code.',
  invalid_quantity: 'Quantity must be greater than zero.',
};

const NOT_FOUND_MESSAGES: Record<string, string> = {
  reservation_not_found: 'Reservation not found.',
  stock_count_not_found: 'Stock count not found.',
  product_not_found: 'Product not found.',
  device_not_found: 'Device not found.',
  warehouse_not_found: 'Warehouse not found.',
  location_not_found: 'Location not found.',
  supplier_not_found: 'Supplier not found.',
  purchase_order_not_found: 'Purchase order not found.',
  purchase_order_line_not_found: 'Purchase order line not found.',
  sales_order_not_found: 'Outgoing order not found.',
};

/**
 * Translates PostgreSQL error codes into stable API errors. Raw database
 * messages never reach the client; only the constraint name is echoed for
 * duplicate-value feedback.
 */
function findPostgresError(error: unknown): PostgresErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (isPostgresError(current)) return current;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function toDatabaseErrorDescriptor(error: unknown): ErrorDescriptor | null {
  const databaseError = findPostgresError(error);
  if (!databaseError) return null;

  const constraint =
    typeof databaseError.constraint === 'string' ? databaseError.constraint : undefined;
  const rawMessage = typeof databaseError.message === 'string' ? databaseError.message : '';
  const details = constraint ? { constraint } : undefined;

  switch (databaseError.code) {
    case '23505':
      if (rawMessage === 'idempotency_key_conflict') {
        return {
          status: 409,
          code: 'idempotency_conflict',
          message: 'This Idempotency-Key was already used for a different request.',
        };
      }
      if (rawMessage === 'supplier_name_conflict') {
        return {
          status: 409,
          code: 'conflict',
          message: 'A supplier with this name already exists.',
        };
      }
      if (constraint === 'devices_org_serial_key') {
        return {
          status: 409,
          code: 'conflict',
          message: 'A device with this serial number is already registered.',
        };
      }
      if (constraint === 'devices_org_imei_key') {
        return {
          status: 409,
          code: 'conflict',
          message: 'A device with this IMEI is already registered.',
        };
      }
      return {
        status: 409,
        code: 'conflict',
        message: 'A record with this value already exists.',
        details,
      };
    case '23503':
      return {
        status: 400,
        code: 'invalid_reference',
        message: 'A referenced record does not exist in this organization.',
        details,
      };
    case '23514':
      return {
        status: 400,
        code: 'constraint_violation',
        message: CONSTRAINT_MESSAGES[rawMessage] ?? 'A data constraint rejected the request.',
        details,
      };
    case '23502':
      return {
        status: 400,
        code: 'validation_error',
        message: 'A required value is missing.',
        details,
      };
    case '42501':
      return {
        status: 403,
        code: 'forbidden',
        message: 'Your role does not allow this action.',
      };
    case '28000':
      return { status: 401, code: 'unauthenticated', message: 'Authentication is required.' };
    case 'P0002':
      return {
        status: 404,
        code: 'not_found',
        message: NOT_FOUND_MESSAGES[rawMessage] ?? 'Record not found.',
        details,
      };
    case '55000':
      return {
        status: 500,
        code: 'operation_unavailable',
        message: 'The operation could not be completed. Try again.',
        details,
      };
    case '22023':
    case '22P02':
    case '22003':
      return {
        status: 400,
        code: 'validation_error',
        message: VALIDATION_MESSAGES[rawMessage] ?? 'A value has an invalid type or range.',
      };
    default:
      return { status: 500, code: 'internal_error', message: 'Internal server error' };
  }
}
