import 'json.dart';

enum DeviceStatus {
  inStock,
  reserved,
  sold,
  returned,
  inRepair,
  lost,
  disposed;

  static DeviceStatus parse(String? wire) => switch (wire) {
    'in_stock' => DeviceStatus.inStock,
    'reserved' => DeviceStatus.reserved,
    'sold' => DeviceStatus.sold,
    'returned' => DeviceStatus.returned,
    'in_repair' => DeviceStatus.inRepair,
    'lost' => DeviceStatus.lost,
    'disposed' => DeviceStatus.disposed,
    _ => DeviceStatus.inStock,
  };

  String get wire => switch (this) {
    DeviceStatus.inStock => 'in_stock',
    DeviceStatus.reserved => 'reserved',
    DeviceStatus.sold => 'sold',
    DeviceStatus.returned => 'returned',
    DeviceStatus.inRepair => 'in_repair',
    DeviceStatus.lost => 'lost',
    DeviceStatus.disposed => 'disposed',
  };
}

enum DeviceCondition {
  newUnit,
  used,
  refurbished,
  damaged,
  defective;

  static DeviceCondition parse(String? wire) => switch (wire) {
    'new' => DeviceCondition.newUnit,
    'used' => DeviceCondition.used,
    'refurbished' => DeviceCondition.refurbished,
    'damaged' => DeviceCondition.damaged,
    'defective' => DeviceCondition.defective,
    _ => DeviceCondition.newUnit,
  };

  String get wire => switch (this) {
    DeviceCondition.newUnit => 'new',
    DeviceCondition.used => 'used',
    DeviceCondition.refurbished => 'refurbished',
    DeviceCondition.damaged => 'damaged',
    DeviceCondition.defective => 'defective',
  };
}

class Device {
  const Device({
    required this.id,
    required this.productId,
    required this.productSku,
    required this.productName,
    required this.serialNumber,
    this.imei,
    required this.condition,
    required this.status,
    required this.warehouseId,
    required this.warehouseCode,
    required this.locationId,
    required this.locationCode,
    this.warrantyStartOn,
    this.warrantyEndOn,
    this.supplierReference,
    this.note,
    this.receivedAt,
  });

  final String id;
  final String productId;
  final String productSku;
  final String productName;
  final String serialNumber;
  final String? imei;
  final DeviceCondition condition;
  final DeviceStatus status;
  final String warehouseId;
  final String warehouseCode;
  final String locationId;
  final String locationCode;
  final String? warrantyStartOn;
  final String? warrantyEndOn;
  final String? supplierReference;
  final String? note;
  final DateTime? receivedAt;

  bool get isSellable => status == DeviceStatus.inStock;

  factory Device.fromJson(Json json) => Device(
    id: asString(json, 'id'),
    productId: asString(json, 'productId'),
    productSku: asString(json, 'productSku'),
    productName: asString(json, 'productName'),
    serialNumber: asString(json, 'serialNumber'),
    imei: asStringOrNull(json, 'imei'),
    condition: DeviceCondition.parse(asStringOrNull(json, 'condition')),
    status: DeviceStatus.parse(asStringOrNull(json, 'status')),
    warehouseId: asString(json, 'warehouseId'),
    warehouseCode: asString(json, 'warehouseCode'),
    locationId: asString(json, 'locationId'),
    locationCode: asString(json, 'locationCode'),
    warrantyStartOn: asStringOrNull(json, 'warrantyStartOn'),
    warrantyEndOn: asStringOrNull(json, 'warrantyEndOn'),
    supplierReference: asStringOrNull(json, 'supplierReference'),
    note: asStringOrNull(json, 'note'),
    receivedAt: asDate(json, 'receivedAt'),
  );
}

class DeviceEvent {
  const DeviceEvent({
    required this.id,
    required this.eventType,
    this.statusFrom,
    this.statusTo,
    this.note,
    this.createdAt,
  });

  final String id;
  final String eventType;
  final DeviceStatus? statusFrom;
  final DeviceStatus? statusTo;
  final String? note;
  final DateTime? createdAt;

  factory DeviceEvent.fromJson(Json json) => DeviceEvent(
    id: asString(json, 'id'),
    eventType: asString(json, 'eventType'),
    statusFrom: asStringOrNull(json, 'statusFrom') == null
        ? null
        : DeviceStatus.parse(asStringOrNull(json, 'statusFrom')),
    statusTo: asStringOrNull(json, 'statusTo') == null
        ? null
        : DeviceStatus.parse(asStringOrNull(json, 'statusTo')),
    note: asStringOrNull(json, 'note'),
    createdAt: asDate(json, 'createdAt'),
  );
}

class DeviceStatusChangeResult {
  const DeviceStatusChangeResult({
    required this.deviceId,
    required this.status,
    required this.previousStatus,
    required this.duplicate,
  });

  final String deviceId;
  final DeviceStatus status;
  final DeviceStatus previousStatus;
  final bool duplicate;

  factory DeviceStatusChangeResult.fromJson(Json json) =>
      DeviceStatusChangeResult(
        deviceId: asString(json, 'deviceId'),
        status: DeviceStatus.parse(asStringOrNull(json, 'status')),
        previousStatus: DeviceStatus.parse(
          asStringOrNull(json, 'previousStatus'),
        ),
        duplicate: asBool(json, 'duplicate'),
      );
}

class DeviceMoveResult {
  const DeviceMoveResult({
    required this.deviceId,
    required this.warehouseId,
    required this.locationId,
    required this.duplicate,
  });

  final String deviceId;
  final String warehouseId;
  final String locationId;
  final bool duplicate;

  factory DeviceMoveResult.fromJson(Json json) => DeviceMoveResult(
    deviceId: asString(json, 'deviceId'),
    warehouseId: asString(json, 'warehouseId'),
    locationId: asString(json, 'locationId'),
    duplicate: asBool(json, 'duplicate'),
  );
}

class DeviceRegistrationResult {
  const DeviceRegistrationResult({
    required this.deviceId,
    required this.serialNumber,
    required this.status,
    required this.duplicate,
  });

  final String deviceId;
  final String serialNumber;
  final DeviceStatus status;
  final bool duplicate;

  factory DeviceRegistrationResult.fromJson(Json json) =>
      DeviceRegistrationResult(
        deviceId: asString(json, 'deviceId'),
        serialNumber: asString(json, 'serialNumber'),
        status: DeviceStatus.parse(asStringOrNull(json, 'status')),
        duplicate: asBool(json, 'duplicate'),
      );
}
