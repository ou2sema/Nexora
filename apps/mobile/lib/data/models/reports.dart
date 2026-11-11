import 'json.dart';

class ReportTotals {
  const ReportTotals({
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.productCount,
    required this.locationCount,
    required this.warehouseCount,
    required this.serializedInStock,
  });

  final double onHand;
  final double reserved;
  final double available;
  final int productCount;
  final int locationCount;
  final int warehouseCount;
  final int serializedInStock;

  factory ReportTotals.fromJson(Json json) => ReportTotals(
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    productCount: asInt(json, 'productCount'),
    locationCount: asInt(json, 'locationCount'),
    warehouseCount: asInt(json, 'warehouseCount'),
    serializedInStock: asInt(json, 'serializedInStock'),
  );
}

class ReportValuation {
  const ReportValuation({
    required this.purchaseValueMinor,
    required this.saleValueMinor,
    required this.unpricedProductCount,
  });

  final int purchaseValueMinor;
  final int saleValueMinor;
  final int unpricedProductCount;

  factory ReportValuation.fromJson(Json json) => ReportValuation(
    purchaseValueMinor: asInt(json, 'purchaseValueMinor'),
    saleValueMinor: asInt(json, 'saleValueMinor'),
    unpricedProductCount: asInt(json, 'unpricedProductCount'),
  );
}

class ReportMovementTotals {
  const ReportMovementTotals({
    required this.count,
    required this.receivedQuantity,
    required this.issuedQuantity,
    required this.adjustedQuantity,
    required this.netQuantity,
  });

  final int count;
  final double receivedQuantity;
  final double issuedQuantity;
  final double adjustedQuantity;
  final double netQuantity;

  factory ReportMovementTotals.fromJson(Json json) => ReportMovementTotals(
    count: asInt(json, 'count'),
    receivedQuantity: asDouble(json, 'receivedQuantity'),
    issuedQuantity: asDouble(json, 'issuedQuantity'),
    adjustedQuantity: asDouble(json, 'adjustedQuantity'),
    netQuantity: asDouble(json, 'netQuantity'),
  );
}

class ReportSeriesPoint {
  const ReportSeriesPoint({
    required this.date,
    required this.receivedQuantity,
    required this.issuedQuantity,
    required this.netQuantity,
  });

  final String date;
  final double receivedQuantity;
  final double issuedQuantity;
  final double netQuantity;

  factory ReportSeriesPoint.fromJson(Json json) => ReportSeriesPoint(
    date: asString(json, 'date'),
    receivedQuantity: asDouble(json, 'receivedQuantity'),
    issuedQuantity: asDouble(json, 'issuedQuantity'),
    netQuantity: asDouble(json, 'netQuantity'),
  );
}

class ReportWarehouseRow {
  const ReportWarehouseRow({
    required this.warehouseId,
    required this.code,
    required this.name,
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.purchaseValueMinor,
    required this.saleValueMinor,
    required this.serializedInStock,
  });

  final String warehouseId;
  final String code;
  final String name;
  final double onHand;
  final double reserved;
  final double available;
  final int purchaseValueMinor;
  final int saleValueMinor;
  final int serializedInStock;

  factory ReportWarehouseRow.fromJson(Json json) => ReportWarehouseRow(
    warehouseId: asString(json, 'warehouseId'),
    code: asString(json, 'code'),
    name: asString(json, 'name'),
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    purchaseValueMinor: asInt(json, 'purchaseValueMinor'),
    saleValueMinor: asInt(json, 'saleValueMinor'),
    serializedInStock: asInt(json, 'serializedInStock'),
  );
}

class ReportWindow {
  const ReportWindow({required this.from, required this.to});

  final String from;
  final String to;

  factory ReportWindow.fromJson(Json json) =>
      ReportWindow(from: asString(json, 'from'), to: asString(json, 'to'));
}

class ReportOverview {
  const ReportOverview({
    required this.generatedAt,
    required this.window,
    required this.totals,
    required this.valuation,
    required this.movements,
    required this.series,
    required this.warehouses,
  });

  final DateTime? generatedAt;
  final ReportWindow window;
  final ReportTotals totals;
  final ReportValuation valuation;
  final ReportMovementTotals movements;
  final List<ReportSeriesPoint> series;
  final List<ReportWarehouseRow> warehouses;

  factory ReportOverview.fromJson(Json json) => ReportOverview(
    generatedAt: asDate(json, 'generatedAt'),
    window: ReportWindow.fromJson(asJson(json['window'])),
    totals: ReportTotals.fromJson(asJson(json['totals'])),
    valuation: ReportValuation.fromJson(asJson(json['valuation'])),
    movements: ReportMovementTotals.fromJson(asJson(json['movements'])),
    series: asJsonList(json['series'])
        .map(ReportSeriesPoint.fromJson)
        .toList(growable: false),
    warehouses: asJsonList(json['warehouses'])
        .map(ReportWarehouseRow.fromJson)
        .toList(growable: false),
  );
}

class LowStockItem {
  const LowStockItem({
    required this.productId,
    required this.sku,
    required this.productName,
    this.categoryName,
    required this.isSerialized,
    required this.reorderThreshold,
    required this.onHand,
    required this.reserved,
    required this.available,
    required this.shortfall,
  });

  final String productId;
  final String sku;
  final String productName;
  final String? categoryName;
  final bool isSerialized;
  final double reorderThreshold;
  final double onHand;
  final double reserved;
  final double available;
  final double shortfall;

  factory LowStockItem.fromJson(Json json) => LowStockItem(
    productId: asString(json, 'productId'),
    sku: asString(json, 'sku'),
    productName: asString(json, 'productName'),
    categoryName: asStringOrNull(json, 'categoryName'),
    isSerialized: asBool(json, 'isSerialized'),
    reorderThreshold: asDouble(json, 'reorderThreshold'),
    onHand: asDouble(json, 'onHand'),
    reserved: asDouble(json, 'reserved'),
    available: asDouble(json, 'available'),
    shortfall: asDouble(json, 'shortfall'),
  );
}

class SupplierPerformanceRow {
  const SupplierPerformanceRow({
    required this.supplierId,
    required this.supplierName,
    required this.ordersCreated,
    required this.ordersReceived,
    required this.onTimeOrders,
    required this.lateOrders,
    this.onTimeRate,
    this.averageLeadTimeDays,
    required this.orderedValueMinor,
    required this.receivedValueMinor,
    required this.receivedQuantity,
    required this.returnedQuantity,
    this.returnRate,
  });

  final String supplierId;
  final String supplierName;
  final int ordersCreated;
  final int ordersReceived;
  final int onTimeOrders;
  final int lateOrders;
  final double? onTimeRate;
  final double? averageLeadTimeDays;
  final int orderedValueMinor;
  final int receivedValueMinor;
  final double receivedQuantity;
  final double returnedQuantity;
  final double? returnRate;

  factory SupplierPerformanceRow.fromJson(Json json) => SupplierPerformanceRow(
    supplierId: asString(json, 'supplierId'),
    supplierName: asString(json, 'supplierName'),
    ordersCreated: asInt(json, 'ordersCreated'),
    ordersReceived: asInt(json, 'ordersReceived'),
    onTimeOrders: asInt(json, 'onTimeOrders'),
    lateOrders: asInt(json, 'lateOrders'),
    onTimeRate: asDoubleOrNull(json, 'onTimeRate'),
    averageLeadTimeDays: asDoubleOrNull(json, 'averageLeadTimeDays'),
    orderedValueMinor: asInt(json, 'orderedValueMinor'),
    receivedValueMinor: asInt(json, 'receivedValueMinor'),
    receivedQuantity: asDouble(json, 'receivedQuantity'),
    returnedQuantity: asDouble(json, 'returnedQuantity'),
    returnRate: asDoubleOrNull(json, 'returnRate'),
  );
}

class SupplierPerformanceResponse {
  const SupplierPerformanceResponse({
    required this.generatedAt,
    required this.window,
    required this.suppliers,
  });

  final DateTime? generatedAt;
  final ReportWindow window;
  final List<SupplierPerformanceRow> suppliers;

  factory SupplierPerformanceResponse.fromJson(Json json) =>
      SupplierPerformanceResponse(
        generatedAt: asDate(json, 'generatedAt'),
        window: ReportWindow.fromJson(asJson(json['window'])),
        suppliers: asJsonList(json['suppliers'])
            .map(SupplierPerformanceRow.fromJson)
            .toList(growable: false),
      );
}
