import { enMessages, type MessageKey } from './messages';

export const EXPORT_TOO_LARGE = /^The export exceeds (\d+) rows\. Narrow the filters\.$/;

const SERVER_MESSAGE_KEYS: Record<string, MessageKey> = {
  'This Idempotency-Key was already used for a different request.':
    'errors.code.idempotency_conflict',
  'A supplier with this name already exists.': 'errors.server.supplierNameConflict',
  'An invitation is already pending for this email.': 'errors.code.invitation_already_pending',
  'This person is already a member of the organization.': 'errors.code.already_member',
  'A device with this serial number is already registered.': 'errors.server.deviceSerialConflict',
  'A device with this IMEI is already registered.': 'errors.server.deviceImeiConflict',
  'A record with this value already exists.': 'errors.code.conflict',
  'A referenced record does not exist in this organization.': 'errors.code.invalid_reference',
  'This invitation is no longer pending.': 'errors.code.invitation_not_pending',
  'This invitation has expired. Ask an owner or admin to send a new one.':
    'errors.code.invitation_expired',
  'Ownership cannot be granted by invitation.': 'errors.code.invitation_role_owner',
  'Ownership is transferred by changing an existing member, not by invitation.':
    'errors.server.invitationRoleOwner',
  'A data constraint rejected the request.': 'errors.code.constraint_violation',
  'A required value is missing.': 'errors.server.requiredMissing',
  'Only an owner can manage owners.': 'errors.code.owner_required',
  'Only platform administrators can create organizations.': 'errors.code.platform_admin_required',
  'Platform administrator access is required.': 'errors.server.platformAdminAccessRequired',
  'Managers can invite viewers only. Ask an owner or admin to add a manager.':
    'errors.code.manager_invites_viewers_only',
  'This invitation was sent to a different email address.': 'errors.code.invitation_email_mismatch',
  'Your account needs an email address to accept invitations.':
    'errors.code.invitation_email_required',
  'Your role does not allow this action.': 'errors.code.forbidden',
  'Authentication is required.': 'errors.code.unauthenticated',
  'A bearer access token is required.': 'errors.server.bearerTokenRequired',
  'The access token is invalid or has expired.': 'errors.code.invalid_token',
  'Record not found.': 'errors.code.not_found',
  'Organization not found.': 'errors.code.organization_not_found',
  'Reservation not found.': 'errors.code.reservation_not_found',
  'Stock count not found.': 'errors.code.stock_count_not_found',
  'Product not found.': 'errors.code.product_not_found',
  'Device not found.': 'errors.code.device_not_found',
  'Warehouse not found.': 'errors.code.warehouse_not_found',
  'Location not found.': 'errors.code.location_not_found',
  'Supplier not found.': 'errors.code.supplier_not_found',
  'Purchase order not found.': 'errors.code.purchase_order_not_found',
  'Purchase order line not found.': 'errors.code.purchase_order_line_not_found',
  'Outgoing order not found.': 'errors.code.sales_order_not_found',
  'Outgoing order line not found.': 'errors.code.sales_order_line_not_found',
  'Purchase return not found.': 'errors.code.purchase_return_not_found',
  'Sales return not found.': 'errors.code.sales_return_not_found',
  'Team member not found.': 'errors.code.member_not_found',
  'Invitation not found.': 'errors.code.invitation_not_found',
  'No product or device matches this code.': 'errors.code.scan_not_found',
  'The operation could not be completed. Try again.': 'errors.code.operation_unavailable',
  'A value has an invalid type or range.': 'errors.server.invalidTypeOrRange',
  'Internal server error': 'errors.code.internal_error',
  'Request validation failed': 'errors.server.requestValidationFailed',
  'The organization could not be created.': 'errors.server.organizationCreateFailed',
  'The organization could not be read after creation.': 'errors.server.organizationReadFailed',
  'Provide an explicit slug: the name contains no letters or digits.':
    'errors.server.explicitSlugRequired',
  'The product could not be created.': 'errors.server.productCreateFailed',
  'The product could not be read.': 'errors.server.productReadFailed',
  'The category could not be created.': 'errors.server.categoryCreateFailed',
  'The brand could not be created.': 'errors.server.brandCreateFailed',
  'The warehouse could not be created.': 'errors.server.warehouseCreateFailed',
  'The storage location could not be created.': 'errors.server.locationCreateFailed',
  'Unexpected invitation response.': 'errors.server.invitationUnexpected',
  'Membership was not created.': 'errors.server.membershipNotCreated',
  'The barcode was not assigned.': 'errors.server.barcodeNotAssigned',
  'Unexpected device operation response.': 'errors.server.unexpectedDeviceOperation',
  'Unexpected operation response.': 'errors.server.unexpectedOperation',
  'Unexpected supplier response.': 'errors.server.unexpectedSupplierResponse',
  'Unexpected stock operation response.': 'errors.server.unexpectedStockOperation',
  'Unexpected stock count response.': 'errors.server.unexpectedStockCount',
  'A category cannot be its own ancestor.': 'errors.server.categoryCycle',
  'An organization must keep at least one owner.': 'errors.server.organizationRequiresOwner',
  'Not enough stock available for this movement.': 'errors.server.insufficientStock',
  'The requested quantity is reserved for an outgoing order.': 'errors.server.stockReserved',
  'The reservation is no longer active.': 'errors.server.reservationNotActive',
  'The reservation does not match this issue.': 'errors.server.reservationMismatch',
  'The reservation was already fulfilled.': 'errors.server.reservationAlreadyFulfilled',
  'An open count already exists for this stock location.': 'errors.server.stockCountAlreadyOpen',
  'This stock count is no longer open.': 'errors.server.stockCountNotOpen',
  'Record at least one line before posting the count.': 'errors.server.stockCountEmpty',
  'The counted quantity is below the reserved quantity.': 'errors.server.stockCountBelowReserved',
  'Serialized products are tracked per device, not by quantity.':
    'errors.server.productNotCountable',
  'This supplier is inactive.': 'errors.server.supplierInactive',
  'Serialized products are issued per device, not through an order line.':
    'errors.server.productSerializedOrderUnsupported',
  'The received quantity exceeds the ordered quantity.': 'errors.server.purchaseOrderOverReceipt',
  'Only ordered purchase orders can receive stock.': 'errors.server.purchaseOrderNotReceivable',
  'A purchase order that received stock cannot be cancelled.':
    'errors.server.purchaseOrderNotCancellable',
  'Only draft purchase orders can be ordered.': 'errors.server.purchaseOrderNotDraft',
  'Only draft outgoing orders can be confirmed.': 'errors.server.salesOrderNotDraft',
  'Only confirmed outgoing orders can be fulfilled.': 'errors.server.salesOrderNotFulfillable',
  'Only draft or confirmed outgoing orders can be cancelled.':
    'errors.server.salesOrderNotCancellable',
  'This outgoing order is missing its stock reservation.':
    'errors.server.salesOrderReservationMissing',
  'Provide one serial number per received unit.': 'errors.server.serialCountMismatch',
  'This product is not serialized; remove the serial numbers.':
    'errors.server.serialNumbersNotSupported',
  'Only received purchase orders can be returned.': 'errors.server.purchaseOrderNotReturnable',
  'The return exceeds the quantity received and not yet returned.':
    'errors.server.purchaseReturnExceedsReceived',
  'Only draft purchase returns can be posted.': 'errors.server.purchaseReturnNotPostable',
  'Only draft purchase returns can be cancelled.': 'errors.server.purchaseReturnNotCancellable',
  'Only fulfilled outgoing orders can be returned.': 'errors.server.salesOrderNotReturnable',
  'The return exceeds the quantity fulfilled and not yet returned.':
    'errors.server.salesReturnExceedsFulfilled',
  'Only draft sales returns can be posted.': 'errors.server.salesReturnNotPostable',
  'Only draft sales returns can be cancelled.': 'errors.server.salesReturnNotCancellable',
  'This device is not in stock.': 'errors.server.deviceNotInStock',
  'This device does not belong to the product on the line.': 'errors.server.deviceProductMismatch',
  'This device is not in the selected depot location.': 'errors.server.deviceWrongLocation',
  'This customer is inactive.': 'errors.server.customerInactive',
  'Customer not found.': 'errors.server.customerNotFound',
  'Sales invoice not found.': 'errors.server.salesInvoiceNotFound',
  'The payment is larger than the amount still due.': 'errors.server.paymentExceedsTotal',
  'The payment amount must be greater than zero.': 'errors.server.invalidPaidAmount',
  'Choose a supported payment method.': 'errors.server.invalidPaymentMethod',
  'Set a sale price for this product or price the line.': 'errors.server.productPriceUndefined',
  'Sell a serialized product by scanning the device.': 'errors.server.serializedLineRequiresDevice',
  'Add at least one line.': 'errors.server.orderRequiresLines',
  'An order can have at most 100 lines.': 'errors.server.orderTooManyLines',
  'Each line needs a product and a positive quantity.': 'errors.server.orderLineInvalid',
  'Each product may appear only once.': 'errors.server.duplicateOrderLine',
  'Enter the customer name.': 'errors.server.customerNameRequired',
  'Enter a customer name.': 'errors.server.invalidCustomerName',
  'Enter a supplier name.': 'errors.server.invalidSupplierName',
  'Use a two-letter country code.': 'errors.server.invalidCountryCode',
  'Quantity must be greater than zero.': 'errors.server.invalidQuantity',
  'Explain why the goods are being returned (at least 3 characters).':
    'errors.server.returnReasonRequired',
  'Each return line needs an order line and a positive quantity.':
    'errors.server.returnLineInvalid',
  'Each device may appear only once.': 'errors.server.duplicateDevice',
  'Enter a valid email address for the invitation.': 'errors.server.invalidInvitationEmail',
  'Provide an Idempotency-Key header between 8 and 120 characters.':
    'errors.code.idempotency_key_required',
};

const AUTH_MESSAGE_KEYS: Record<string, MessageKey> = {
  'Invalid login credentials': 'errors.auth.invalidCredentials',
  'Email not confirmed': 'errors.auth.emailNotConfirmed',
  'User already registered': 'errors.auth.userExists',
  'Password should be at least 6 characters': 'errors.auth.passwordTooShort',
  'Signups not allowed for this instance': 'errors.auth.signupsDisabled',
  'Email rate limit exceeded': 'errors.auth.rateLimited',
  'An email address is required': 'errors.auth.emailRequired',
  'Auth session missing!': 'errors.auth.sessionExpired',
  'Invalid Refresh Token: Refresh Token Not Found': 'errors.auth.sessionExpired',
  'JWT expired': 'errors.auth.sessionExpired',
};

export function textMessageKey(message: string): MessageKey | null {
  return SERVER_MESSAGE_KEYS[message] ?? AUTH_MESSAGE_KEYS[message] ?? null;
}

export function codeMessageKey(code: string): MessageKey | null {
  const key = `errors.code.${code}`;
  return key in enMessages ? (key as MessageKey) : null;
}
