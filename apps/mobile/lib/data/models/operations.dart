import 'json.dart';

enum PurchaseOrderStatus {
  draft,
  ordered,
  partiallyReceived,
  received,
  cancelled;

  static PurchaseOrderStatus parse(String? wire) => switch (wire) {
    'ordered' => PurchaseOrderStatus.ordered,
    'partially_received' => PurchaseOrderStatus.partiallyReceived,
    'received' => PurchaseOrderStatus.received,
    'cancelled' => PurchaseOrderStatus.cancelled,
    _ => PurchaseOrderStatus.draft,
  };
}

enum SalesOrderStatus {
  draft,
  confirmed,
  fulfilled,
  cancelled;

  static SalesOrderStatus parse(String? wire) =>
      enumFromWire(SalesOrderStatus.values, wire, SalesOrderStatus.draft);
}

enum ReturnStatus {
  draft,
  posted,
  cancelled;

  static ReturnStatus parse(String? wire) =>
      enumFromWire(ReturnStatus.values, wire, ReturnStatus.draft);
}

class Supplier {
  const Supplier({
    required this.id,
    required this.name,
    this.contactName,
    this.email,
    this.phone,
    this.addressLine,
    this.city,
    this.countryCode,
    this.taxId,
    this.notes,
    required this.isActive,
  });

  final String id;
  final String name;
  final String? contactName;
  final String? email;
  final String? phone;
  final String? addressLine;
  final String? city;
  final String? countryCode;
  final String? taxId;
  final String? notes;
  final bool isActive;

  factory Supplier.fromJson(Json json) => Supplier(
    id: asString(json, 'id'),
    name: asString(json, 'name'),
    contactName: asStringOrNull(json, 'contactName'),
    email: asStringOrNull(json, 'email'),
    phone: asStringOrNull(json, 'phone'),
    addressLine: asStringOrNull(json, 'addressLine'),
    city: asStringOrNull(json, 'city'),
    countryCode: asStringOrNull(json, 'countryCode'),
    taxId: asStringOrNull(json, 'taxId'),
    notes: asStringOrNull(json, 'notes'),
    isActive: asBool(json, 'isActive', true),
  );
}

class PurchaseOrderLine {
  const PurchaseOrderLine({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.isSerialized,
    required this.quantityOrdered,
    required this.quantityReceived,
    required this.quantityReturned,
    this.unitCostMinor,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final bool isSerialized;
  final double quantityOrdered;
  final double quantityReceived;
  final double quantityReturned;
  final int? unitCostMinor;

  double get quantityOutstanding =>
      quantityOrdered - quantityReceived - quantityReturned;

  factory PurchaseOrderLine.fromJson(Json json) => PurchaseOrderLine(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    isSerialized: asBool(json, 'isSerialized'),
    quantityOrdered: asDouble(json, 'quantityOrdered'),
    quantityReceived: asDouble(json, 'quantityReceived'),
    quantityReturned: asDouble(json, 'quantityReturned'),
    unitCostMinor: asIntOrNull(json, 'unitCostMinor'),
  );
}

class PurchaseOrder {
  const PurchaseOrder({
    required this.id,
    required this.number,
    required this.supplierId,
    required this.supplierName,
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    required this.status,
    this.reference,
    this.notes,
    this.expectedOn,
    this.orderedAt,
    this.receivedAt,
    this.cancelledAt,
    required this.lineCount,
    required this.totalQuantity,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String number;
  final String supplierId;
  final String supplierName;
  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final PurchaseOrderStatus status;
  final String? reference;
  final String? notes;
  final String? expectedOn;
  final DateTime? orderedAt;
  final DateTime? receivedAt;
  final DateTime? cancelledAt;
  final int lineCount;
  final double totalQuantity;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isReceivable =>
      status == PurchaseOrderStatus.ordered ||
      status == PurchaseOrderStatus.partiallyReceived;

  factory PurchaseOrder.fromJson(Json json) => PurchaseOrder(
    id: asString(json, 'id'),
    number: asString(json, 'number'),
    supplierId: asString(json, 'supplierId'),
    supplierName: asString(json, 'supplierName'),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    status: PurchaseOrderStatus.parse(asStringOrNull(json, 'status')),
    reference: asStringOrNull(json, 'reference'),
    notes: asStringOrNull(json, 'notes'),
    expectedOn: asStringOrNull(json, 'expectedOn'),
    orderedAt: asDate(json, 'orderedAt'),
    receivedAt: asDate(json, 'receivedAt'),
    cancelledAt: asDate(json, 'cancelledAt'),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    createdAt: asDate(json, 'createdAt'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

class PurchaseOrderDetail {
  const PurchaseOrderDetail({required this.order, required this.lines});

  final PurchaseOrder order;
  final List<PurchaseOrderLine> lines;

  factory PurchaseOrderDetail.fromJson(Json json) => PurchaseOrderDetail(
    order: PurchaseOrder.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(PurchaseOrderLine.fromJson)
        .toList(growable: false),
  );
}

class PurchaseOrderCreateResult {
  const PurchaseOrderCreateResult({
    required this.orderId,
    required this.number,
    required this.status,
    required this.lineCount,
    required this.totalQuantity,
    required this.duplicate,
  });

  final String orderId;
  final String number;
  final PurchaseOrderStatus status;
  final int lineCount;
  final double totalQuantity;
  final bool duplicate;

  factory PurchaseOrderCreateResult.fromJson(Json json) =>
      PurchaseOrderCreateResult(
        orderId: asString(json, 'orderId'),
        number: asString(json, 'number'),
        status: PurchaseOrderStatus.parse(asStringOrNull(json, 'status')),
        lineCount: asInt(json, 'lineCount'),
        totalQuantity: asDouble(json, 'totalQuantity'),
        duplicate: asBool(json, 'duplicate'),
      );
}

class PurchaseOrderStatusResult {
  const PurchaseOrderStatusResult({
    required this.orderId,
    required this.number,
    required this.status,
    required this.duplicate,
  });

  final String orderId;
  final String number;
  final PurchaseOrderStatus status;
  final bool duplicate;

  factory PurchaseOrderStatusResult.fromJson(Json json) =>
      PurchaseOrderStatusResult(
        orderId: asString(json, 'orderId'),
        number: asString(json, 'number'),
        status: PurchaseOrderStatus.parse(asStringOrNull(json, 'status')),
        duplicate: asBool(json, 'duplicate'),
      );
}

class PurchaseReceiptResult extends PurchaseOrderStatusResult {
  const PurchaseReceiptResult({
    required super.orderId,
    required super.number,
    required super.status,
    required super.duplicate,
    required this.receivedLines,
    required this.receivedQuantity,
  });

  final int receivedLines;
  final double receivedQuantity;

  factory PurchaseReceiptResult.fromJson(Json json) => PurchaseReceiptResult(
    orderId: asString(json, 'orderId'),
    number: asString(json, 'number'),
    status: PurchaseOrderStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
    receivedLines: asInt(json, 'receivedLines'),
    receivedQuantity: asDouble(json, 'receivedQuantity'),
  );
}

class SalesOrderLine {
  const SalesOrderLine({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.quantity,
    required this.quantityReturned,
    this.unitPriceMinor,
    this.reservationId,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final double quantity;
  final double quantityReturned;
  final int? unitPriceMinor;
  final String? reservationId;

  factory SalesOrderLine.fromJson(Json json) => SalesOrderLine(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    quantity: asDouble(json, 'quantity'),
    quantityReturned: asDouble(json, 'quantityReturned'),
    unitPriceMinor: asIntOrNull(json, 'unitPriceMinor'),
    reservationId: asStringOrNull(json, 'reservationId'),
  );
}

class SalesOrder {
  const SalesOrder({
    required this.id,
    required this.number,
    required this.customerName,
    this.customerEmail,
    this.customerPhone,
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    required this.status,
    this.reference,
    this.notes,
    this.confirmedAt,
    this.fulfilledAt,
    this.cancelledAt,
    required this.lineCount,
    required this.totalQuantity,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String number;
  final String customerName;
  final String? customerEmail;
  final String? customerPhone;
  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final SalesOrderStatus status;
  final String? reference;
  final String? notes;
  final DateTime? confirmedAt;
  final DateTime? fulfilledAt;
  final DateTime? cancelledAt;
  final int lineCount;
  final double totalQuantity;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory SalesOrder.fromJson(Json json) => SalesOrder(
    id: asString(json, 'id'),
    number: asString(json, 'number'),
    customerName: asString(json, 'customerName'),
    customerEmail: asStringOrNull(json, 'customerEmail'),
    customerPhone: asStringOrNull(json, 'customerPhone'),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
    reference: asStringOrNull(json, 'reference'),
    notes: asStringOrNull(json, 'notes'),
    confirmedAt: asDate(json, 'confirmedAt'),
    fulfilledAt: asDate(json, 'fulfilledAt'),
    cancelledAt: asDate(json, 'cancelledAt'),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    createdAt: asDate(json, 'createdAt'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

class SalesOrderDetail {
  const SalesOrderDetail({required this.order, required this.lines});

  final SalesOrder order;
  final List<SalesOrderLine> lines;

  factory SalesOrderDetail.fromJson(Json json) => SalesOrderDetail(
    order: SalesOrder.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(SalesOrderLine.fromJson)
        .toList(growable: false),
  );
}

class SalesOrderCreateResult {
  const SalesOrderCreateResult({
    required this.orderId,
    required this.number,
    required this.status,
    required this.lineCount,
    required this.totalQuantity,
    required this.duplicate,
  });

  final String orderId;
  final String number;
  final SalesOrderStatus status;
  final int lineCount;
  final double totalQuantity;
  final bool duplicate;

  factory SalesOrderCreateResult.fromJson(Json json) => SalesOrderCreateResult(
    orderId: asString(json, 'orderId'),
    number: asString(json, 'number'),
    status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class SalesOrderStatusResult {
  const SalesOrderStatusResult({
    required this.orderId,
    required this.number,
    required this.status,
    required this.duplicate,
  });

  final String orderId;
  final String number;
  final SalesOrderStatus status;
  final bool duplicate;

  factory SalesOrderStatusResult.fromJson(Json json) => SalesOrderStatusResult(
    orderId: asString(json, 'orderId'),
    number: asString(json, 'number'),
    status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
  );
}

class SalesOrderConfirmResult extends SalesOrderStatusResult {
  const SalesOrderConfirmResult({
    required super.orderId,
    required super.number,
    required super.status,
    required super.duplicate,
    required this.reservedQuantity,
  });

  final double reservedQuantity;

  factory SalesOrderConfirmResult.fromJson(Json json) =>
      SalesOrderConfirmResult(
        orderId: asString(json, 'orderId'),
        number: asString(json, 'number'),
        status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
        duplicate: asBool(json, 'duplicate'),
        reservedQuantity: asDouble(json, 'reservedQuantity'),
      );
}

class SalesOrderFulfilResult extends SalesOrderStatusResult {
  const SalesOrderFulfilResult({
    required super.orderId,
    required super.number,
    required super.status,
    required super.duplicate,
    required this.issuedQuantity,
  });

  final double issuedQuantity;

  factory SalesOrderFulfilResult.fromJson(Json json) => SalesOrderFulfilResult(
    orderId: asString(json, 'orderId'),
    number: asString(json, 'number'),
    status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
    issuedQuantity: asDouble(json, 'issuedQuantity'),
  );
}

class SalesOrderCancelResult extends SalesOrderStatusResult {
  const SalesOrderCancelResult({
    required super.orderId,
    required super.number,
    required super.status,
    required super.duplicate,
    required this.releasedReservations,
  });

  final int releasedReservations;

  factory SalesOrderCancelResult.fromJson(Json json) => SalesOrderCancelResult(
    orderId: asString(json, 'orderId'),
    number: asString(json, 'number'),
    status: SalesOrderStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
    releasedReservations: asInt(json, 'releasedReservations'),
  );
}

class ReturnDevice {
  const ReturnDevice({required this.deviceId, required this.serialNumber});

  final String deviceId;
  final String serialNumber;

  factory ReturnDevice.fromJson(Json json) => ReturnDevice(
    deviceId: asString(json, 'deviceId'),
    serialNumber: asString(json, 'serialNumber'),
  );
}

class PurchaseReturnLine {
  const PurchaseReturnLine({
    required this.id,
    required this.purchaseOrderLineId,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.isSerialized,
    required this.quantity,
    required this.quantityReceived,
    required this.devices,
  });

  final String id;
  final String purchaseOrderLineId;
  final String productId;
  final String productSku;
  final String productName;
  final bool isSerialized;
  final double quantity;
  final double quantityReceived;
  final List<ReturnDevice> devices;

  factory PurchaseReturnLine.fromJson(Json json) => PurchaseReturnLine(
    id: asString(json, 'id'),
    purchaseOrderLineId: asString(json, 'purchaseOrderLineId'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    isSerialized: asBool(json, 'isSerialized'),
    quantity: asDouble(json, 'quantity'),
    quantityReceived: asDouble(json, 'quantityReceived'),
    devices: asJsonList(json['devices'])
        .map(ReturnDevice.fromJson)
        .toList(growable: false),
  );
}

class PurchaseReturn {
  const PurchaseReturn({
    required this.id,
    required this.number,
    required this.purchaseOrderId,
    required this.purchaseOrderNumber,
    required this.supplierId,
    required this.supplierName,
    required this.warehouseCode,
    required this.locationCode,
    required this.status,
    required this.reason,
    this.reference,
    this.postedAt,
    this.cancelledAt,
    required this.lineCount,
    required this.totalQuantity,
    this.createdAt,
  });

  final String id;
  final String number;
  final String purchaseOrderId;
  final String purchaseOrderNumber;
  final String supplierId;
  final String supplierName;
  final String warehouseCode;
  final String locationCode;
  final ReturnStatus status;
  final String reason;
  final String? reference;
  final DateTime? postedAt;
  final DateTime? cancelledAt;
  final int lineCount;
  final double totalQuantity;
  final DateTime? createdAt;

  factory PurchaseReturn.fromJson(Json json) => PurchaseReturn(
    id: asString(json, 'id'),
    number: asString(json, 'number'),
    purchaseOrderId: asString(json, 'purchaseOrderId'),
    purchaseOrderNumber: asString(json, 'purchaseOrderNumber'),
    supplierId: asString(json, 'supplierId'),
    supplierName: asString(json, 'supplierName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    status: ReturnStatus.parse(asStringOrNull(json, 'status')),
    reason: asString(json, 'reason'),
    reference: asStringOrNull(json, 'reference'),
    postedAt: asDate(json, 'postedAt'),
    cancelledAt: asDate(json, 'cancelledAt'),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class PurchaseReturnDetail {
  const PurchaseReturnDetail({required this.returnOrder, required this.lines});

  final PurchaseReturn returnOrder;
  final List<PurchaseReturnLine> lines;

  factory PurchaseReturnDetail.fromJson(Json json) => PurchaseReturnDetail(
    returnOrder: PurchaseReturn.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(PurchaseReturnLine.fromJson)
        .toList(growable: false),
  );
}

class SalesReturnLine {
  const SalesReturnLine({
    required this.id,
    required this.salesOrderLineId,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.quantity,
    required this.quantityFulfilled,
  });

  final String id;
  final String salesOrderLineId;
  final String productId;
  final String productSku;
  final String productName;
  final double quantity;
  final double quantityFulfilled;

  factory SalesReturnLine.fromJson(Json json) => SalesReturnLine(
    id: asString(json, 'id'),
    salesOrderLineId: asString(json, 'salesOrderLineId'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    quantity: asDouble(json, 'quantity'),
    quantityFulfilled: asDouble(json, 'quantityFulfilled'),
  );
}

class SalesReturn {
  const SalesReturn({
    required this.id,
    required this.number,
    required this.salesOrderId,
    required this.salesOrderNumber,
    required this.customerName,
    required this.warehouseCode,
    required this.locationCode,
    required this.status,
    required this.reason,
    this.reference,
    this.postedAt,
    this.cancelledAt,
    required this.lineCount,
    required this.totalQuantity,
    this.createdAt,
  });

  final String id;
  final String number;
  final String salesOrderId;
  final String salesOrderNumber;
  final String customerName;
  final String warehouseCode;
  final String locationCode;
  final ReturnStatus status;
  final String reason;
  final String? reference;
  final DateTime? postedAt;
  final DateTime? cancelledAt;
  final int lineCount;
  final double totalQuantity;
  final DateTime? createdAt;

  factory SalesReturn.fromJson(Json json) => SalesReturn(
    id: asString(json, 'id'),
    number: asString(json, 'number'),
    salesOrderId: asString(json, 'salesOrderId'),
    salesOrderNumber: asString(json, 'salesOrderNumber'),
    customerName: asString(json, 'customerName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    status: ReturnStatus.parse(asStringOrNull(json, 'status')),
    reason: asString(json, 'reason'),
    reference: asStringOrNull(json, 'reference'),
    postedAt: asDate(json, 'postedAt'),
    cancelledAt: asDate(json, 'cancelledAt'),
    lineCount: asInt(json, 'lineCount'),
    totalQuantity: asDouble(json, 'totalQuantity'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class SalesReturnDetail {
  const SalesReturnDetail({required this.returnOrder, required this.lines});

  final SalesReturn returnOrder;
  final List<SalesReturnLine> lines;

  factory SalesReturnDetail.fromJson(Json json) => SalesReturnDetail(
    returnOrder: SalesReturn.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(SalesReturnLine.fromJson)
        .toList(growable: false),
  );
}

class ReturnCreateResult {
  const ReturnCreateResult({
    required this.returnId,
    required this.number,
    required this.status,
    required this.lineCount,
    required this.quantity,
    required this.duplicate,
  });

  final String returnId;
  final String number;
  final ReturnStatus status;
  final int lineCount;
  final double quantity;
  final bool duplicate;

  factory ReturnCreateResult.fromJson(Json json) => ReturnCreateResult(
    returnId: asString(json, 'returnId'),
    number: asString(json, 'number'),
    status: ReturnStatus.parse(asStringOrNull(json, 'status')),
    lineCount: asInt(json, 'lineCount'),
    quantity: asDouble(json, 'quantity'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class ReturnStatusResult {
  const ReturnStatusResult({
    required this.returnId,
    required this.number,
    required this.status,
    required this.duplicate,
  });

  final String returnId;
  final String number;
  final ReturnStatus status;
  final bool duplicate;

  factory ReturnStatusResult.fromJson(Json json) => ReturnStatusResult(
    returnId: asString(json, 'returnId'),
    number: asString(json, 'number'),
    status: ReturnStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
  );
}

class ReturnPostResult extends ReturnStatusResult {
  const ReturnPostResult({
    required super.returnId,
    required super.number,
    required super.status,
    required super.duplicate,
    required this.quantity,
  });

  final double quantity;

  factory ReturnPostResult.fromJson(Json json) => ReturnPostResult(
    returnId: asString(json, 'returnId'),
    number: asString(json, 'number'),
    status: ReturnStatus.parse(asStringOrNull(json, 'status')),
    duplicate: asBool(json, 'duplicate'),
    quantity: asDouble(json, 'quantity'),
  );
}
