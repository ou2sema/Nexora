import 'json.dart';

enum StockMovementType {
  receipt,
  issue,
  adjustment,
  transferOut,
  transferIn;

  static StockMovementType parse(String? wire) => switch (wire) {
    'receipt' => StockMovementType.receipt,
    'issue' => StockMovementType.issue,
    'adjustment' => StockMovementType.adjustment,
    'transfer_out' => StockMovementType.transferOut,
    'transfer_in' => StockMovementType.transferIn,
    _ => StockMovementType.adjustment,
  };

  String get wire => switch (this) {
    StockMovementType.receipt => 'receipt',
    StockMovementType.issue => 'issue',
    StockMovementType.adjustment => 'adjustment',
    StockMovementType.transferOut => 'transfer_out',
    StockMovementType.transferIn => 'transfer_in',
  };
}

class StockLevel {
  const StockLevel({
    required this.productId,
    required this.sku,
    required this.productName,
    required this.warehouseId,
    required this.warehouseCode,
    required this.warehouseName,
    required this.locationId,
    required this.locationCode,
    required this.onHand,
    required this.reserved,
    required this.available,
    this.updatedAt,
  });

  final String productId;
  final String sku;
  final String productName;
  final String warehouseId;
  final String warehouseCode;
  final String warehouseName;
  final String locationId;
  final String locationCode;
  final double onHand;
  final double reserved;
  final double available;
  final DateTime? updatedAt;

  factory StockLevel.fromJson(Json json) => StockLevel(
    productId: asString(json, 'productId'),
    sku: asString(json, 'sku'),
    productName: asString(json, 'productName'),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    warehouseName: asString(json, 'warehouseName'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

class StockSummary {
  const StockSummary({
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.locationCount,
    required this.productCount,
  });

  final double onHand;
  final double reserved;
  final double available;
  final int locationCount;
  final int productCount;

  factory StockSummary.fromJson(Json json) => StockSummary(
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    locationCount: asInt(json, 'locationCount'),
    productCount: asInt(json, 'productCount'),
  );
}

class StockMovement {
  const StockMovement({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.warehouseCode,
    required this.locationCode,
    required this.type,
    required this.quantityDelta,
    required this.onHandAfter,
    this.reason,
    required this.referenceType,
    this.referenceId,
    this.createdAt,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final String warehouseCode;
  final String locationCode;
  final StockMovementType type;
  final double quantityDelta;
  final double onHandAfter;
  final String? reason;
  final String referenceType;
  final String? referenceId;
  final DateTime? createdAt;

  factory StockMovement.fromJson(Json json) => StockMovement(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    type: StockMovementType.parse(asStringOrNull(json, 'movementType')),
    quantityDelta: asDouble(json, 'quantityDelta'),
    onHandAfter: asDouble(json, 'onHandAfter'),
    reason: asStringOrNull(json, 'reason'),
    referenceType: asString(json, 'referenceType'),
    referenceId: asStringOrNull(json, 'referenceId'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class StockReservation {
  const StockReservation({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.warehouseCode,
    required this.locationCode,
    required this.quantity,
    required this.status,
    this.note,
    this.expiresAt,
    this.createdAt,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final String warehouseCode;
  final String locationCode;
  final double quantity;
  final String status;
  final String? note;
  final DateTime? expiresAt;
  final DateTime? createdAt;

  factory StockReservation.fromJson(Json json) => StockReservation(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    quantity: asDouble(json, 'quantity'),
    status: asString(json, 'status'),
    note: asStringOrNull(json, 'note'),
    expiresAt: asDate(json, 'expiresAt'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class StockPostingResult {
  const StockPostingResult({
    required this.movementId,
    required this.onHand,
    required this.available,
    required this.duplicate,
  });

  final String movementId;
  final double onHand;
  final double available;
  final bool duplicate;

  factory StockPostingResult.fromJson(Json json) => StockPostingResult(
    movementId: asString(json, 'movementId'),
    onHand: asDouble(json, 'onHand'),
    available: asDouble(json, 'available'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class StockTransferResult {
  const StockTransferResult({
    required this.transferId,
    required this.quantity,
    required this.sourceOnHand,
    required this.targetOnHand,
    required this.duplicate,
  });

  final String transferId;
  final double quantity;
  final double sourceOnHand;
  final double targetOnHand;
  final bool duplicate;

  factory StockTransferResult.fromJson(Json json) => StockTransferResult(
    transferId: asString(json, 'transferId'),
    quantity: asDouble(json, 'quantity'),
    sourceOnHand: asDouble(json, 'sourceOnHand'),
    targetOnHand: asDouble(json, 'targetOnHand'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class ReservationResult {
  const ReservationResult({
    required this.reservationId,
    required this.quantity,
    required this.reserved,
    required this.available,
    required this.duplicate,
  });

  final String reservationId;
  final double quantity;
  final double reserved;
  final double available;
  final bool duplicate;

  factory ReservationResult.fromJson(Json json) => ReservationResult(
    reservationId: asString(json, 'reservationId'),
    quantity: asDouble(json, 'quantity'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class StockReconciliationRow {
  const StockReconciliationRow({
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.warehouseCode,
    required this.locationCode,
    required this.balanceOnHand,
    required this.ledgerOnHand,
    required this.difference,
    required this.movementCount,
  });

  final String productId;
  final String productSku;
  final String productName;
  final String warehouseCode;
  final String locationCode;
  final double balanceOnHand;
  final double ledgerOnHand;
  final double difference;
  final int movementCount;

  bool get balanced => difference == 0;

  factory StockReconciliationRow.fromJson(Json json) => StockReconciliationRow(
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    balanceOnHand: asDouble(json, 'balanceOnHand'),
    ledgerOnHand: asDouble(json, 'ledgerOnHand'),
    difference: asDouble(json, 'difference'),
    movementCount: asInt(json, 'movementCount'),
  );
}

class StockRepairRow {
  const StockRepairRow({
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.warehouseCode,
    required this.locationCode,
    required this.previousOnHand,
    required this.ledgerOnHand,
    required this.repaired,
  });

  final String productId;
  final String productSku;
  final String productName;
  final String warehouseCode;
  final String locationCode;
  final double previousOnHand;
  final double ledgerOnHand;
  final bool repaired;

  factory StockRepairRow.fromJson(Json json) => StockRepairRow(
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationCode: asString(json, 'locationCode'),
    previousOnHand: asDouble(json, 'previousOnHand'),
    ledgerOnHand: asDouble(json, 'ledgerOnHand'),
    repaired: asBool(json, 'repaired'),
  );
}
