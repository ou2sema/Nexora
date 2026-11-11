import 'json.dart';

/// Request bodies the interface builds. Every list here mirrors a server schema;
/// totals, tenant and roles are never part of a draft.
class SupplierDraft {
  const SupplierDraft({
    required this.name,
    this.contactName,
    this.email,
    this.phone,
    this.addressLine,
    this.city,
    this.countryCode,
    this.taxId,
    this.notes,
  });

  final String name;
  final String? contactName;
  final String? email;
  final String? phone;
  final String? addressLine;
  final String? city;
  final String? countryCode;
  final String? taxId;
  final String? notes;

  Map<String, dynamic> toJson() => withoutNulls({
    'name': name,
    'contactName': contactName,
    'email': email,
    'phone': phone,
    'addressLine': addressLine,
    'city': city,
    'countryCode': countryCode,
    'taxId': taxId,
    'notes': notes,
  });
}

class CustomerDraft {
  const CustomerDraft({
    required this.name,
    this.email,
    this.phone,
    this.addressLine,
    this.city,
    this.countryCode,
    this.taxId,
  });

  final String name;
  final String? email;
  final String? phone;
  final String? addressLine;
  final String? city;
  final String? countryCode;
  final String? taxId;

  Map<String, dynamic> toJson() => withoutNulls({
    'name': name,
    'email': email,
    'phone': phone,
    'addressLine': addressLine,
    'city': city,
    'countryCode': countryCode,
    'taxId': taxId,
  });
}

class OrderLineDraft {
  const OrderLineDraft({
    required this.productId,
    required this.quantity,
    this.unitAmountMinor,
  });

  final String productId;
  final double quantity;
  final int? unitAmountMinor;

  Map<String, dynamic> toPurchaseJson() => withoutNulls({
    'productId': productId,
    'quantity': quantity,
    'unitCostMinor': unitAmountMinor,
  });

  Map<String, dynamic> toSalesJson() => withoutNulls({
    'productId': productId,
    'quantity': quantity,
    'unitPriceMinor': unitAmountMinor,
  });
}

class PurchaseOrderDraft {
  const PurchaseOrderDraft({
    required this.supplierId,
    required this.warehouseId,
    required this.locationId,
    this.expectedOn,
    this.reference,
    this.notes,
    required this.lines,
  });

  final String supplierId;
  final String warehouseId;
  final String locationId;
  final String? expectedOn;
  final String? reference;
  final String? notes;
  final List<OrderLineDraft> lines;

  Map<String, dynamic> toJson() => withoutNulls({
    'supplierId': supplierId,
    'warehouseId': warehouseId,
    'locationId': locationId,
    'expectedOn': expectedOn,
    'reference': reference,
    'notes': notes,
    'lines': lines.map((line) => line.toPurchaseJson()).toList(growable: false),
  });
}

class ReceiptSerialDraft {
  const ReceiptSerialDraft({required this.serialNumber, this.imei});

  final String serialNumber;
  final String? imei;

  Map<String, dynamic> toJson() =>
      withoutNulls({'serialNumber': serialNumber, 'imei': imei});
}

class ReceiptLineDraft {
  const ReceiptLineDraft({
    required this.lineId,
    required this.quantity,
    this.serials = const [],
  });

  final String lineId;
  final double quantity;
  final List<ReceiptSerialDraft> serials;

  Map<String, dynamic> toJson() => withoutNulls({
    'lineId': lineId,
    'quantity': quantity,
    'serials': serials.isEmpty
        ? null
        : serials.map((serial) => serial.toJson()).toList(growable: false),
  });
}

class PurchaseReceiptDraft {
  const PurchaseReceiptDraft({this.note, required this.lines});

  final String? note;
  final List<ReceiptLineDraft> lines;

  Map<String, dynamic> toJson() => withoutNulls({
    'note': note,
    'lines': lines.map((line) => line.toJson()).toList(growable: false),
  });
}

class SalesOrderDraft {
  const SalesOrderDraft({
    required this.customerName,
    this.customerEmail,
    this.customerPhone,
    required this.warehouseId,
    required this.locationId,
    this.reference,
    this.notes,
    required this.lines,
  });

  final String customerName;
  final String? customerEmail;
  final String? customerPhone;
  final String warehouseId;
  final String locationId;
  final String? reference;
  final String? notes;
  final List<OrderLineDraft> lines;

  Map<String, dynamic> toJson() => withoutNulls({
    'customerName': customerName,
    'customerEmail': customerEmail,
    'customerPhone': customerPhone,
    'warehouseId': warehouseId,
    'locationId': locationId,
    'reference': reference,
    'notes': notes,
    'lines': lines.map((line) => line.toSalesJson()).toList(growable: false),
  });
}

class PurchaseReturnLineDraft {
  const PurchaseReturnLineDraft({
    required this.purchaseOrderLineId,
    required this.quantity,
    this.deviceIds = const [],
  });

  final String purchaseOrderLineId;
  final double quantity;
  final List<String> deviceIds;

  Map<String, dynamic> toJson() => withoutNulls({
    'purchaseOrderLineId': purchaseOrderLineId,
    'quantity': quantity,
    'deviceIds': deviceIds.isEmpty ? null : deviceIds,
  });
}

class PurchaseReturnDraft {
  const PurchaseReturnDraft({
    required this.reason,
    this.reference,
    required this.lines,
  });

  final String reason;
  final String? reference;
  final List<PurchaseReturnLineDraft> lines;

  Map<String, dynamic> toJson() => withoutNulls({
    'reason': reason,
    'reference': reference,
    'lines': lines.map((line) => line.toJson()).toList(growable: false),
  });
}

class SalesReturnLineDraft {
  const SalesReturnLineDraft({
    required this.salesOrderLineId,
    required this.quantity,
  });

  final String salesOrderLineId;
  final double quantity;

  Map<String, dynamic> toJson() => {
    'salesOrderLineId': salesOrderLineId,
    'quantity': quantity,
  };
}

class SalesReturnDraft {
  const SalesReturnDraft({
    required this.reason,
    this.reference,
    required this.lines,
  });

  final String reason;
  final String? reference;
  final List<SalesReturnLineDraft> lines;

  Map<String, dynamic> toJson() => withoutNulls({
    'reason': reason,
    'reference': reference,
    'lines': lines.map((line) => line.toJson()).toList(growable: false),
  });
}

class StockPostingDraft {
  const StockPostingDraft({
    required this.productId,
    required this.warehouseId,
    required this.locationId,
    required this.type,
    required this.quantity,
    this.reason,
  });

  final String productId;
  final String warehouseId;
  final String locationId;
  final String type;
  final double quantity;
  final String? reason;

  Map<String, dynamic> toJson() => withoutNulls({
    'productId': productId,
    'warehouseId': warehouseId,
    'locationId': locationId,
    'type': type,
    'quantity': quantity,
    'reason': reason,
  });
}

class StockTransferDraft {
  const StockTransferDraft({
    required this.productId,
    required this.sourceWarehouseId,
    required this.sourceLocationId,
    required this.targetWarehouseId,
    required this.targetLocationId,
    required this.quantity,
    this.reason,
  });

  final String productId;
  final String sourceWarehouseId;
  final String sourceLocationId;
  final String targetWarehouseId;
  final String targetLocationId;
  final double quantity;
  final String? reason;

  Map<String, dynamic> toJson() => withoutNulls({
    'productId': productId,
    'sourceWarehouseId': sourceWarehouseId,
    'sourceLocationId': sourceLocationId,
    'targetWarehouseId': targetWarehouseId,
    'targetLocationId': targetLocationId,
    'quantity': quantity,
    'reason': reason,
  });
}

class StockReservationDraft {
  const StockReservationDraft({
    required this.productId,
    required this.warehouseId,
    required this.locationId,
    required this.quantity,
    this.expiresAt,
    this.note,
  });

  final String productId;
  final String warehouseId;
  final String locationId;
  final double quantity;
  final String? expiresAt;
  final String? note;

  Map<String, dynamic> toJson() => withoutNulls({
    'productId': productId,
    'warehouseId': warehouseId,
    'locationId': locationId,
    'quantity': quantity,
    'expiresAt': expiresAt,
    'note': note,
  });
}

class StockCountStartDraft {
  const StockCountStartDraft({
    required this.warehouseId,
    required this.locationId,
    this.note,
  });

  final String warehouseId;
  final String locationId;
  final String? note;

  Map<String, dynamic> toJson() => withoutNulls({
    'warehouseId': warehouseId,
    'locationId': locationId,
    'note': note,
  });
}

class DeviceDraft {
  const DeviceDraft({
    required this.productId,
    required this.serialNumber,
    this.imei,
    this.condition,
    required this.warehouseId,
    required this.locationId,
    this.warrantyStartOn,
    this.warrantyEndOn,
    this.supplierReference,
    this.note,
  });

  final String productId;
  final String serialNumber;
  final String? imei;
  final String? condition;
  final String warehouseId;
  final String locationId;
  final String? warrantyStartOn;
  final String? warrantyEndOn;
  final String? supplierReference;
  final String? note;

  Map<String, dynamic> toJson() => withoutNulls({
    'productId': productId,
    'serialNumber': serialNumber,
    'imei': imei,
    'condition': condition,
    'warehouseId': warehouseId,
    'locationId': locationId,
    'warrantyStartOn': warrantyStartOn,
    'warrantyEndOn': warrantyEndOn,
    'supplierReference': supplierReference,
    'note': note,
  });
}
