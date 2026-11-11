import 'catalog.dart';
import 'devices.dart';
import 'json.dart';

class ScanStockLine {
  const ScanStockLine({
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    required this.onHand,
    required this.reserved,
    required this.available,
  });

  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final double onHand;
  final double reserved;
  final double available;

  factory ScanStockLine.fromJson(Json json) => ScanStockLine(
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
  );
}

class ScanTotals {
  const ScanTotals({
    required this.onHand,
    required this.reserved,
    required this.available,
  });

  final double onHand;
  final double reserved;
  final double available;

  factory ScanTotals.fromJson(Json json) => ScanTotals(
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
  );
}

enum TrackedItemStatus {
  inStock,
  sold,
  returned,
  lost;

  static TrackedItemStatus parse(String? wire) => switch (wire) {
    'sold' => TrackedItemStatus.sold,
    'returned' => TrackedItemStatus.returned,
    'lost' => TrackedItemStatus.lost,
    _ => TrackedItemStatus.inStock,
  };
}

enum TrackedItemEventType {
  received,
  moved,
  sold,
  returned,
  markedLost,
  statusChanged;

  static TrackedItemEventType parse(String? wire) => switch (wire) {
    'moved' => TrackedItemEventType.moved,
    'sold' => TrackedItemEventType.sold,
    'returned' => TrackedItemEventType.returned,
    'marked_lost' => TrackedItemEventType.markedLost,
    'status_changed' => TrackedItemEventType.statusChanged,
    _ => TrackedItemEventType.received,
  };
}

class TrackedItemEvent {
  const TrackedItemEvent({
    required this.id,
    required this.eventType,
    this.statusFrom,
    this.statusTo,
    this.note,
    this.createdAt,
  });

  final String id;
  final TrackedItemEventType eventType;
  final TrackedItemStatus? statusFrom;
  final TrackedItemStatus? statusTo;
  final String? note;
  final DateTime? createdAt;

  factory TrackedItemEvent.fromJson(Json json) => TrackedItemEvent(
    id: asString(json, 'id'),
    eventType: TrackedItemEventType.parse(asStringOrNull(json, 'eventType')),
    statusFrom: asStringOrNull(json, 'statusFrom') == null
        ? null
        : TrackedItemStatus.parse(asStringOrNull(json, 'statusFrom')),
    statusTo: asStringOrNull(json, 'statusTo') == null
        ? null
        : TrackedItemStatus.parse(asStringOrNull(json, 'statusTo')),
    note: asStringOrNull(json, 'note'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class TrackedItemSummary {
  const TrackedItemSummary({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.unitCode,
    this.serialNumber,
    this.imei,
    required this.status,
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    this.purchaseOrderNumber,
    this.receivedAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final String unitCode;
  final String? serialNumber;
  final String? imei;
  final TrackedItemStatus status;
  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final String? purchaseOrderNumber;
  final DateTime? receivedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory TrackedItemSummary.fromJson(Json json) => TrackedItemSummary(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    unitCode: asString(json, 'unitCode'),
    serialNumber: asStringOrNull(json, 'serialNumber'),
    imei: asStringOrNull(json, 'imei'),
    status: TrackedItemStatus.parse(asStringOrNull(json, 'status')),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    purchaseOrderNumber: asStringOrNull(json, 'purchaseOrderNumber'),
    receivedAt: asDate(json, 'receivedAt'),
    createdAt: asDate(json, 'createdAt'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

sealed class ScanResult {
  const ScanResult();

  static ScanResult fromJson(Json json) => switch (asString(json, 'kind')) {
    'tracked_item' => ScanTrackedItemResult(
      item: TrackedItemSummary.fromJson(asJson(json['item'])),
      product: Product.fromJson(asJson(json['product'])),
      events: asJsonList(json['events'])
          .map(TrackedItemEvent.fromJson)
          .toList(growable: false),
    ),
    'device' => ScanDeviceResult(Device.fromJson(asJson(json['device']))),
    _ => ScanProductResult(
      product: Product.fromJson(asJson(json['product'])),
      stockLines: asJsonList(json['stockLines'])
          .map(ScanStockLine.fromJson)
          .toList(growable: false),
      totals: ScanTotals.fromJson(asJson(json['totals'])),
    ),
  };
}

class ScanProductResult extends ScanResult {
  const ScanProductResult({
    required this.product,
    required this.stockLines,
    required this.totals,
  });

  final Product product;
  final List<ScanStockLine> stockLines;
  final ScanTotals totals;
}

class ScanDeviceResult extends ScanResult {
  const ScanDeviceResult(this.device);

  final Device device;
}

class ScanTrackedItemResult extends ScanResult {
  const ScanTrackedItemResult({
    required this.item,
    required this.product,
    required this.events,
  });

  final TrackedItemSummary item;
  final Product product;
  final List<TrackedItemEvent> events;
}

class LabelItem {
  const LabelItem.product(this.productId, {this.copies})
    : kind = 'product',
      deviceId = null,
      itemId = null;

  const LabelItem.device(this.deviceId, {this.copies})
    : kind = 'device',
      productId = null,
      itemId = null;

  const LabelItem.item(this.itemId, {this.copies})
    : kind = 'item',
      productId = null,
      deviceId = null;

  final String kind;
  final String? productId;
  final String? deviceId;
  final String? itemId;
  final int? copies;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'kind': kind,
    if (kind == 'product') 'productId': productId!,
    if (kind == 'device') 'deviceId': deviceId!,
    if (kind == 'item') 'itemId': itemId!,
    if (copies != null) 'copies': copies,
  };
}

class BarcodeAssignmentResult {
  const BarcodeAssignmentResult({
    required this.productId,
    required this.barcode,
  });

  final String productId;
  final String barcode;

  factory BarcodeAssignmentResult.fromJson(Json json) =>
      BarcodeAssignmentResult(
        productId: asString(json, 'productId'),
        barcode: asString(json, 'barcode'),
      );
}

enum StockCountStatus {
  open,
  posted,
  cancelled;

  static StockCountStatus parse(String? wire) =>
      enumFromWire(StockCountStatus.values, wire, StockCountStatus.open);
}

class StockCountLine {
  const StockCountLine({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.countedQuantity,
    required this.onHand,
    required this.variance,
    this.updatedAt,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final double countedQuantity;
  final double onHand;
  final double variance;
  final DateTime? updatedAt;

  factory StockCountLine.fromJson(Json json) => StockCountLine(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    countedQuantity: asDouble(json, 'countedQuantity'),
    onHand: asDouble(json, 'onHand'),
    variance: asDouble(json, 'variance'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

class StockCountSummary {
  const StockCountSummary({
    required this.id,
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    required this.status,
    this.note,
    required this.lineCount,
    this.createdAt,
    this.postedAt,
  });

  final String id;
  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final StockCountStatus status;
  final String? note;
  final int lineCount;
  final DateTime? createdAt;
  final DateTime? postedAt;

  factory StockCountSummary.fromJson(Json json) => StockCountSummary(
    id: asString(json, 'id'),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    status: StockCountStatus.parse(asStringOrNull(json, 'status')),
    note: asStringOrNull(json, 'note'),
    lineCount: asInt(json, 'lineCount'),
    createdAt: asDate(json, 'createdAt'),
    postedAt: asDate(json, 'postedAt'),
  );
}

class StockCount {
  const StockCount({required this.summary, required this.lines});

  final StockCountSummary summary;
  final List<StockCountLine> lines;

  factory StockCount.fromJson(Json json) => StockCount(
    summary: StockCountSummary.fromJson(json),
    lines: asJsonList(json['lines'])
        .map(StockCountLine.fromJson)
        .toList(growable: false),
  );
}

class StockCountStartResult {
  const StockCountStartResult({
    required this.countId,
    required this.warehouseId,
    required this.locationId,
    required this.status,
    this.createdAt,
  });

  final String countId;
  final String warehouseId;
  final String locationId;
  final StockCountStatus status;
  final DateTime? createdAt;

  factory StockCountStartResult.fromJson(Json json) => StockCountStartResult(
    countId: asString(json, 'countId'),
    warehouseId: asString(json, 'warehouseId'),
    locationId: asString(json, 'locationId'),
    status: StockCountStatus.parse(asStringOrNull(json, 'status')),
    createdAt: asDate(json, 'createdAt'),
  );
}

class StockCountRecordResult {
  const StockCountRecordResult({
    required this.lineId,
    required this.productId,
    required this.countedQuantity,
  });

  final String lineId;
  final String productId;
  final double countedQuantity;

  factory StockCountRecordResult.fromJson(Json json) => StockCountRecordResult(
    lineId: asString(json, 'lineId'),
    productId: asString(json, 'productId'),
    countedQuantity: asDouble(json, 'countedQuantity'),
  );
}

class StockCountAdjustment {
  const StockCountAdjustment({
    required this.productId,
    required this.previousOnHand,
    required this.countedQuantity,
    required this.delta,
  });

  final String productId;
  final double previousOnHand;
  final double countedQuantity;
  final double delta;

  factory StockCountAdjustment.fromJson(Json json) => StockCountAdjustment(
    productId: asString(json, 'productId'),
    previousOnHand: asDouble(json, 'previousOnHand'),
    countedQuantity: asDouble(json, 'countedQuantity'),
    delta: asDouble(json, 'delta'),
  );
}

class StockCountPostResult {
  const StockCountPostResult({
    required this.countId,
    required this.status,
    required this.lineCount,
    required this.adjustedLines,
    required this.adjustments,
    required this.duplicate,
  });

  final String countId;
  final StockCountStatus status;
  final int lineCount;
  final int adjustedLines;
  final List<StockCountAdjustment> adjustments;
  final bool duplicate;

  factory StockCountPostResult.fromJson(Json json) => StockCountPostResult(
    countId: asString(json, 'countId'),
    status: StockCountStatus.parse(asStringOrNull(json, 'status')),
    lineCount: asInt(json, 'lineCount'),
    adjustedLines: asInt(json, 'adjustedLines'),
    adjustments: asJsonList(json['adjustments'])
        .map(StockCountAdjustment.fromJson)
        .toList(growable: false),
    duplicate: asBool(json, 'duplicate'),
  );
}

class StockCountDiscardResult {
  const StockCountDiscardResult({required this.countId, required this.status});

  final String countId;
  final StockCountStatus status;

  factory StockCountDiscardResult.fromJson(Json json) =>
      StockCountDiscardResult(
        countId: asString(json, 'countId'),
        status: StockCountStatus.parse(asStringOrNull(json, 'status')),
      );
}
