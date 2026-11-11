import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import 'models/account.dart';
import 'models/admin.dart';
import 'models/catalog.dart';
import 'models/devices.dart';
import 'models/drafts.dart';
import 'models/invoicing.dart';
import 'models/json.dart';
import 'models/operations.dart';
import 'models/reports.dart';
import 'models/scanning.dart';
import 'models/stock.dart';
import 'models/team.dart';

/// The typed surface of the Nexora API. Every method takes the organization the
/// caller is acting in; there is no default tenant on the client.
class NexoraApi {
  NexoraApi(this._client);

  final ApiClient _client;

  String _org(String organizationId) => 'organizations/$organizationId';

  static Map<String, dynamic> _page(int page, int pageSize) => {
    'page': page,
    'pageSize': pageSize,
  };

  Future<List<Json>> _list(String path, {Map<String, dynamic>? query}) async {
    final data = await _client.get<dynamic>(path, query: query);
    if (data is List) return data.whereType<Json>().toList(growable: false);
    return asJsonList(data);
  }

  // ---------------------------------------------------------------- account

  Future<MeResponse> me({CancelToken? cancelToken}) async =>
      MeResponse.fromJson(
        asJson(await _client.get<dynamic>('me', cancelToken: cancelToken)),
      );

  Future<List<PendingInvitation>> pendingInvitations({
    CancelToken? cancelToken,
  }) async {
    final data = await _client.get<dynamic>(
      'me/invitations',
      cancelToken: cancelToken,
    );
    final items = data is List ? data : asJson(data)['items'];
    return asJsonList(items)
        .map(PendingInvitation.fromJson)
        .toList(growable: false);
  }

  Future<Membership> acceptInvitation(
    String invitationId, {
    CancelToken? cancelToken,
  }) async => Membership.fromJson(
    asJson(
      await _client.post<dynamic>(
        'me/invitations/$invitationId/acceptance',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<CreatedOrganization> createOrganization({
    required String name,
    String? slug,
    String? firstMemberEmail,
    String? firstMemberRole,
    CancelToken? cancelToken,
  }) async => CreatedOrganization.fromJson(
    asJson(
      await _client.post<dynamic>(
        'organizations',
        body: {
          'name': name,
          if (slug != null && slug.isNotEmpty) 'slug': slug,
          if (firstMemberEmail != null && firstMemberEmail.isNotEmpty)
            'firstMemberEmail': firstMemberEmail,
          'firstMemberRole': ?firstMemberRole,
        },
        cancelToken: cancelToken,
      ),
    ),
  );

  // ---------------------------------------------------------------- catalog

  Future<Paged<Product>> listProducts(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? search,
    String? status,
    String? categoryId,
    String? brandId,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/products',
      query: {
        ..._page(page, pageSize),
        'search': search,
        'status': status,
        'categoryId': categoryId,
        'brandId': brandId,
      },
      cancelToken: cancelToken,
    ),
    Product.fromJson,
  );

  Future<Product> getProduct(
    String organizationId,
    String productId, {
    CancelToken? cancelToken,
  }) async => Product.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/products/$productId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Product> createProduct(
    String organizationId,
    Json body, {
    CancelToken? cancelToken,
  }) async => Product.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/products',
        body: body,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Product> updateProduct(
    String organizationId,
    String productId,
    Json body, {
    CancelToken? cancelToken,
  }) async => Product.fromJson(
    asJson(
      await _client.patch<dynamic>(
        '${_org(organizationId)}/products/$productId',
        body: body,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<List<Category>> listCategories(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final rows = await _list('${_org(organizationId)}/categories');
    return rows.map(Category.fromJson).toList(growable: false);
  }

  Future<Category> createCategory(
    String organizationId, {
    required String name,
    String? slug,
    String? parentId,
    CancelToken? cancelToken,
  }) async => Category.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/categories',
        body: {'name': name, 'slug': ?slug, 'parentId': ?parentId},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<List<Brand>> listBrands(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final rows = await _list('${_org(organizationId)}/brands');
    return rows.map(Brand.fromJson).toList(growable: false);
  }

  Future<Brand> createBrand(
    String organizationId, {
    required String name,
    CancelToken? cancelToken,
  }) async => Brand.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/brands',
        body: {'name': name},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<List<Warehouse>> listWarehouses(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final rows = await _list('${_org(organizationId)}/warehouses');
    return rows.map(Warehouse.fromJson).toList(growable: false);
  }

  Future<Warehouse> createWarehouse(
    String organizationId,
    Json body, {
    CancelToken? cancelToken,
  }) async => Warehouse.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/warehouses',
        body: body,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StorageLocation> createLocation(
    String organizationId,
    String warehouseId, {
    required String code,
    required String name,
    CancelToken? cancelToken,
  }) async => StorageLocation.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/warehouses/$warehouseId/locations',
        body: {'code': code, 'name': name},
        cancelToken: cancelToken,
      ),
    ),
  );

  // ------------------------------------------------------------------ stock

  Future<Paged<StockLevel>> listStockLevels(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? productId,
    String? warehouseId,
    String? locationId,
    String? search,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/stock-levels',
      query: {
        ..._page(page, pageSize),
        'productId': productId,
        'warehouseId': warehouseId,
        'locationId': locationId,
        'search': search,
      },
      cancelToken: cancelToken,
    ),
    StockLevel.fromJson,
  );

  Future<StockSummary> stockSummary(
    String organizationId, {
    CancelToken? cancelToken,
  }) async => StockSummary.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/stock-levels/summary',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Paged<StockMovement>> listMovements(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? productId,
    String? warehouseId,
    String? locationId,
    String? movementType,
    String? from,
    String? to,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/stock-movements',
      query: {
        ..._page(page, pageSize),
        'productId': productId,
        'warehouseId': warehouseId,
        'locationId': locationId,
        'movementType': movementType,
        'from': from,
        'to': to,
      },
      cancelToken: cancelToken,
    ),
    StockMovement.fromJson,
  );

  Future<StockPostingResult> postMovement(
    String organizationId,
    StockPostingDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => StockPostingResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-movements',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StockTransferResult> transferStock(
    String organizationId,
    StockTransferDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => StockTransferResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-transfers',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Paged<StockReservation>> listReservations(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    String? productId,
    String? warehouseId,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/stock-reservations',
      query: {
        ..._page(page, pageSize),
        'status': status,
        'productId': productId,
        'warehouseId': warehouseId,
      },
      cancelToken: cancelToken,
    ),
    StockReservation.fromJson,
  );

  Future<ReservationResult> reserveStock(
    String organizationId,
    StockReservationDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReservationResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-reservations',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<void> releaseReservation(
    String organizationId,
    String reservationId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    await _client.post<dynamic>(
      '${_org(organizationId)}/stock-reservations/$reservationId/release',
      idempotencyKey: idempotencyKey,
      cancelToken: cancelToken,
    );
  }

  Future<List<StockReconciliationRow>> reconciliation(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final rows = await _list(
      '${_org(organizationId)}/stock-reconciliation',
      query: null,
    );
    return rows.map(StockReconciliationRow.fromJson).toList(growable: false);
  }

  Future<List<StockRepairRow>> reconcileStock(
    String organizationId, {
    required bool dryRun,
    CancelToken? cancelToken,
  }) async {
    final data = await _client.post<dynamic>(
      '${_org(organizationId)}/stock-reconciliation/repair',
      body: {'dryRun': dryRun},
      cancelToken: cancelToken,
    );
    return asJsonList(data)
        .map(StockRepairRow.fromJson)
        .toList(growable: false);
  }

  // ---------------------------------------------------------------- scanning

  Future<ScanResult> scan(
    String organizationId, {
    required String code,
    CancelToken? cancelToken,
  }) async => ScanResult.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/scan',
        query: {'code': code},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<BarcodeAssignmentResult> assignBarcode(
    String organizationId,
    String productId, {
    CancelToken? cancelToken,
  }) async => BarcodeAssignmentResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/products/$productId/barcode',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<DownloadedFile> labelSheet(
    String organizationId,
    List<LabelItem> items, {
    CancelToken? cancelToken,
  }) => _client.postBytes(
    '${_org(organizationId)}/labels',
    body: {'items': items.map((item) => item.toJson()).toList(growable: false)},
    fallbackFilename: 'nexora-labels.pdf',
    cancelToken: cancelToken,
  );

  Future<Paged<StockCountSummary>> listStockCounts(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/stock-counts',
      query: {..._page(page, pageSize), 'status': status},
      cancelToken: cancelToken,
    ),
    StockCountSummary.fromJson,
  );

  Future<StockCountStartResult> startStockCount(
    String organizationId,
    StockCountStartDraft draft, {
    CancelToken? cancelToken,
  }) async => StockCountStartResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-counts',
        body: draft.toJson(),
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StockCount> getStockCount(
    String organizationId,
    String countId, {
    CancelToken? cancelToken,
  }) async => StockCount.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/stock-counts/$countId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StockCountRecordResult> recordStockCount(
    String organizationId,
    String countId, {
    required String productId,
    required double quantity,
    String? mode,
    CancelToken? cancelToken,
  }) async => StockCountRecordResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-counts/$countId/lines',
        body: {'productId': productId, 'quantity': quantity, 'mode': ?mode},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StockCountPostResult> postStockCount(
    String organizationId,
    String countId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => StockCountPostResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-counts/$countId/post',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<StockCountDiscardResult> discardStockCount(
    String organizationId,
    String countId, {
    CancelToken? cancelToken,
  }) async => StockCountDiscardResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/stock-counts/$countId/discard',
        cancelToken: cancelToken,
      ),
    ),
  );

  // ---------------------------------------------------------------- devices

  Future<Paged<Device>> listDevices(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    String? productId,
    String? warehouseId,
    String? search,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/devices',
      query: {
        ..._page(page, pageSize),
        'status': status,
        'productId': productId,
        'warehouseId': warehouseId,
        'search': search,
      },
      cancelToken: cancelToken,
    ),
    Device.fromJson,
  );

  Future<DeviceRegistrationResult> registerDevice(
    String organizationId,
    DeviceDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => DeviceRegistrationResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/devices',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Device> getDevice(
    String organizationId,
    String deviceId, {
    CancelToken? cancelToken,
  }) async => Device.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/devices/$deviceId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<List<DeviceEvent>> deviceEvents(
    String organizationId,
    String deviceId, {
    CancelToken? cancelToken,
  }) async {
    final rows = await _list(
      '${_org(organizationId)}/devices/$deviceId/events',
    );
    return rows.map(DeviceEvent.fromJson).toList(growable: false);
  }

  Future<DeviceStatusChangeResult> changeDeviceStatus(
    String organizationId,
    String deviceId, {
    required DeviceStatus status,
    String? note,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => DeviceStatusChangeResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/devices/$deviceId/status',
        body: {'status': status.wire, 'note': note},
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<DeviceMoveResult> moveDevice(
    String organizationId,
    String deviceId, {
    required String warehouseId,
    required String locationId,
    String? note,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => DeviceMoveResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/devices/$deviceId/location',
        body: {
          'warehouseId': warehouseId,
          'locationId': locationId,
          'note': note,
        },
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  // -------------------------------------------------------------- suppliers

  Future<Paged<Supplier>> listSuppliers(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? search,
    bool? isActive,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/suppliers',
      query: {
        ..._page(page, pageSize),
        'search': search,
        'isActive': isActive?.toString(),
      },
      cancelToken: cancelToken,
    ),
    Supplier.fromJson,
  );

  Future<Supplier> createSupplier(
    String organizationId,
    SupplierDraft draft, {
    CancelToken? cancelToken,
  }) async => Supplier.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/suppliers',
        body: draft.toJson(),
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Supplier> updateSupplier(
    String organizationId,
    String supplierId,
    Json body, {
    CancelToken? cancelToken,
  }) async => Supplier.fromJson(
    asJson(
      await _client.patch<dynamic>(
        '${_org(organizationId)}/suppliers/$supplierId',
        body: body,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Supplier> setSupplierActive(
    String organizationId,
    String supplierId, {
    required bool isActive,
    CancelToken? cancelToken,
  }) async => Supplier.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/suppliers/$supplierId/activation',
        body: {'isActive': isActive},
        cancelToken: cancelToken,
      ),
    ),
  );

  // -------------------------------------------------------------- customers

  Future<Paged<Customer>> listCustomers(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? search,
    bool? isActive,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/customers',
      query: {
        ..._page(page, pageSize),
        'search': search,
        'isActive': isActive?.toString(),
      },
      cancelToken: cancelToken,
    ),
    Customer.fromJson,
  );

  Future<Customer> createCustomer(
    String organizationId,
    CustomerDraft draft, {
    CancelToken? cancelToken,
  }) async => Customer.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/customers',
        body: draft.toJson(),
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Customer> updateCustomer(
    String organizationId,
    String customerId,
    Json body, {
    CancelToken? cancelToken,
  }) async => Customer.fromJson(
    asJson(
      await _client.patch<dynamic>(
        '${_org(organizationId)}/customers/$customerId',
        body: body,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Customer> setCustomerActive(
    String organizationId,
    String customerId, {
    required bool isActive,
    CancelToken? cancelToken,
  }) async => Customer.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/customers/$customerId/activation',
        body: {'isActive': isActive},
        cancelToken: cancelToken,
      ),
    ),
  );

  // --------------------------------------------------------- purchase orders

  Future<Paged<PurchaseOrder>> listPurchaseOrders(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    String? supplierId,
    String? search,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/purchase-orders',
      query: {
        ..._page(page, pageSize),
        'status': status,
        'supplierId': supplierId,
        'search': search,
      },
      cancelToken: cancelToken,
    ),
    PurchaseOrder.fromJson,
  );

  Future<PurchaseOrderCreateResult> createPurchaseOrder(
    String organizationId,
    PurchaseOrderDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => PurchaseOrderCreateResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<PurchaseOrderDetail> getPurchaseOrder(
    String organizationId,
    String orderId, {
    CancelToken? cancelToken,
  }) async => PurchaseOrderDetail.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<PurchaseOrderStatusResult> markPurchaseOrderOrdered(
    String organizationId,
    String orderId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => PurchaseOrderStatusResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/order',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<PurchaseReceiptResult> receivePurchaseOrder(
    String organizationId,
    String orderId,
    PurchaseReceiptDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => PurchaseReceiptResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/receipts',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<PurchaseOrderStatusResult> cancelPurchaseOrder(
    String organizationId,
    String orderId, {
    String? reason,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => PurchaseOrderStatusResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/cancel',
        body: withoutNulls({'reason': reason}),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Paged<PurchaseReturn>> listPurchaseReturns(
    String organizationId,
    String orderId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/purchase-orders/$orderId/returns',
      query: {..._page(page, pageSize), 'status': status},
      cancelToken: cancelToken,
    ),
    PurchaseReturn.fromJson,
  );

  Future<ReturnCreateResult> createPurchaseReturn(
    String organizationId,
    String orderId,
    PurchaseReturnDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnCreateResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/returns',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<PurchaseReturnDetail> getPurchaseReturn(
    String organizationId,
    String orderId,
    String returnId, {
    CancelToken? cancelToken,
  }) async => PurchaseReturnDetail.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/returns/$returnId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<ReturnPostResult> postPurchaseReturn(
    String organizationId,
    String orderId,
    String returnId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnPostResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/returns/$returnId/post',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<ReturnStatusResult> cancelPurchaseReturn(
    String organizationId,
    String orderId,
    String returnId, {
    String? reason,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnStatusResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/purchase-orders/$orderId/returns/$returnId/cancel',
        body: withoutNulls({'reason': reason}),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  // ------------------------------------------------------------ sales orders

  Future<Paged<SalesOrder>> listSalesOrders(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    String? search,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/sales-orders',
      query: {..._page(page, pageSize), 'status': status, 'search': search},
      cancelToken: cancelToken,
    ),
    SalesOrder.fromJson,
  );

  Future<SalesOrderCreateResult> createSalesOrder(
    String organizationId,
    SalesOrderDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesOrderCreateResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesOrderDetail> getSalesOrder(
    String organizationId,
    String orderId, {
    CancelToken? cancelToken,
  }) async => SalesOrderDetail.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesOrderConfirmResult> confirmSalesOrder(
    String organizationId,
    String orderId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesOrderConfirmResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/confirm',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesOrderFulfilResult> fulfilSalesOrder(
    String organizationId,
    String orderId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesOrderFulfilResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/fulfil',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesOrderCancelResult> cancelSalesOrder(
    String organizationId,
    String orderId, {
    String? reason,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesOrderCancelResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/cancel',
        body: withoutNulls({'reason': reason}),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Paged<SalesReturn>> listSalesReturns(
    String organizationId,
    String orderId, {
    int page = 1,
    int pageSize = 25,
    String? status,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/sales-orders/$orderId/returns',
      query: {..._page(page, pageSize), 'status': status},
      cancelToken: cancelToken,
    ),
    SalesReturn.fromJson,
  );

  Future<ReturnCreateResult> createSalesReturn(
    String organizationId,
    String orderId,
    SalesReturnDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnCreateResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/returns',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesReturnDetail> getSalesReturn(
    String organizationId,
    String orderId,
    String returnId, {
    CancelToken? cancelToken,
  }) async => SalesReturnDetail.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/returns/$returnId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<ReturnPostResult> postSalesReturn(
    String organizationId,
    String orderId,
    String returnId, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnPostResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/returns/$returnId/post',
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<ReturnStatusResult> cancelSalesReturn(
    String organizationId,
    String orderId,
    String returnId, {
    String? reason,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => ReturnStatusResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-orders/$orderId/returns/$returnId/cancel',
        body: withoutNulls({'reason': reason}),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  // ---------------------------------------------------------------- invoices

  Future<Paged<SalesInvoice>> listInvoices(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? paymentStatus,
    String? search,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/sales-invoices',
      query: {
        ..._page(page, pageSize),
        'paymentStatus': paymentStatus,
        'search': search,
      },
      cancelToken: cancelToken,
    ),
    SalesInvoice.fromJson,
  );

  Future<SalesInvoiceCreateResult> createInvoice(
    String organizationId,
    SalesInvoiceDraft draft, {
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesInvoiceCreateResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-invoices',
        body: draft.toJson(),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesInvoiceDetail> getInvoice(
    String organizationId,
    String invoiceId, {
    CancelToken? cancelToken,
  }) async => SalesInvoiceDetail.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/sales-invoices/$invoiceId',
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<SalesInvoicePaymentResult> addInvoicePayment(
    String organizationId,
    String invoiceId, {
    required int amountMinor,
    required PaymentMethod method,
    String? note,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async => SalesInvoicePaymentResult.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/sales-invoices/$invoiceId/payments',
        body: withoutNulls({
          'amountMinor': amountMinor,
          'method': method.wire,
          'note': note,
        }),
        idempotencyKey: idempotencyKey,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<DownloadedFile> purchaseOrderPdf(
    String organizationId,
    String orderId, {
    String locale = 'en',
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/purchase-orders/$orderId/pdf',
    query: {'locale': locale},
    fallbackFilename: 'purchase-order-$orderId.pdf',
    cancelToken: cancelToken,
  );

  Future<DownloadedFile> purchaseReturnPdf(
    String organizationId,
    String orderId,
    String returnId, {
    String locale = 'en',
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/purchase-orders/$orderId/returns/$returnId/pdf',
    query: {'locale': locale},
    fallbackFilename: 'purchase-return-$returnId.pdf',
    cancelToken: cancelToken,
  );

  Future<DownloadedFile> invoicePdf(
    String organizationId,
    String invoiceId, {
    String locale = 'en',
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/sales-invoices/$invoiceId/pdf',
    query: {'locale': locale},
    fallbackFilename: 'invoice-$invoiceId.pdf',
    cancelToken: cancelToken,
  );

  Future<DownloadedFile> issueNotePdf(
    String organizationId,
    String invoiceId, {
    String locale = 'en',
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/sales-invoices/$invoiceId/issue-note/pdf',
    query: {'locale': locale},
    fallbackFilename: 'issue-note-$invoiceId.pdf',
    cancelToken: cancelToken,
  );

  // ---------------------------------------------------------------- reports

  Future<ReportOverview> reportOverview(
    String organizationId, {
    String? warehouseId,
    String? categoryId,
    String? from,
    String? to,
    CancelToken? cancelToken,
  }) async => ReportOverview.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/reports/overview',
        query: {
          'warehouseId': warehouseId,
          'categoryId': categoryId,
          'from': from,
          'to': to,
        },
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Paged<LowStockItem>> lowStock(
    String organizationId, {
    int page = 1,
    int pageSize = 25,
    String? warehouseId,
    String? categoryId,
    CancelToken? cancelToken,
  }) async => Paged.fromJson(
    await _client.get<dynamic>(
      '${_org(organizationId)}/reports/low-stock',
      query: {
        ..._page(page, pageSize),
        'warehouseId': warehouseId,
        'categoryId': categoryId,
      },
      cancelToken: cancelToken,
    ),
    LowStockItem.fromJson,
  );

  Future<SupplierPerformanceResponse> supplierPerformance(
    String organizationId, {
    String? supplierId,
    String? from,
    String? to,
    CancelToken? cancelToken,
  }) async => SupplierPerformanceResponse.fromJson(
    asJson(
      await _client.get<dynamic>(
        '${_org(organizationId)}/reports/supplier-performance',
        query: {'supplierId': supplierId, 'from': from, 'to': to},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<DownloadedFile> stockLevelsCsv(
    String organizationId, {
    String? warehouseId,
    String? categoryId,
    String? search,
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/reports/exports/stock-levels.csv',
    query: {
      'warehouseId': warehouseId,
      'categoryId': categoryId,
      'search': search,
    },
    fallbackFilename: 'stock-levels.csv',
    cancelToken: cancelToken,
  );

  Future<DownloadedFile> movementsCsv(
    String organizationId, {
    String? warehouseId,
    String? categoryId,
    String? movementType,
    String? from,
    String? to,
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/reports/exports/movements.csv',
    query: {
      'warehouseId': warehouseId,
      'categoryId': categoryId,
      'movementType': movementType,
      'from': from,
      'to': to,
    },
    fallbackFilename: 'movements.csv',
    cancelToken: cancelToken,
  );

  // ------------------------------------------------------------------- team

  Future<List<TeamMember>> teamMembers(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final data = await _client.get<dynamic>(
      '${_org(organizationId)}/members',
      cancelToken: cancelToken,
    );
    return asJsonList(asJson(data)['items'])
        .map(TeamMember.fromJson)
        .toList(growable: false);
  }

  Future<TeamMember> changeMemberRole(
    String organizationId,
    String userId, {
    required String role,
    CancelToken? cancelToken,
  }) async => TeamMember.fromJson(
    asJson(
      await _client.patch<dynamic>(
        '${_org(organizationId)}/members/$userId',
        body: {'role': role},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<void> removeMember(
    String organizationId,
    String userId, {
    CancelToken? cancelToken,
  }) => _client.delete(
    '${_org(organizationId)}/members/$userId',
    cancelToken: cancelToken,
  );

  Future<List<Invitation>> invitations(
    String organizationId, {
    CancelToken? cancelToken,
  }) async {
    final data = await _client.get<dynamic>(
      '${_org(organizationId)}/invitations',
      cancelToken: cancelToken,
    );
    return asJsonList(asJson(data)['items'])
        .map(Invitation.fromJson)
        .toList(growable: false);
  }

  Future<Invitation> createInvitation(
    String organizationId, {
    required String email,
    required String role,
    CancelToken? cancelToken,
  }) async => Invitation.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/invitations',
        body: {'email': email, 'role': role},
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<Invitation> revokeInvitation(
    String organizationId,
    String invitationId, {
    CancelToken? cancelToken,
  }) async => Invitation.fromJson(
    asJson(
      await _client.post<dynamic>(
        '${_org(organizationId)}/invitations/$invitationId/revocation',
        cancelToken: cancelToken,
      ),
    ),
  );

  // ------------------------------------------------------------------ admin

  Future<List<AdminOrganization>> adminOrganizations({
    CancelToken? cancelToken,
  }) async {
    final data = await _client.get<dynamic>(
      'admin/organizations',
      cancelToken: cancelToken,
    );
    return asJsonList(asJson(data)['items'])
        .map(AdminOrganization.fromJson)
        .toList(growable: false);
  }

  Future<List<AdminAuditEvent>> adminAudit({
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    final data = await _client.get<dynamic>(
      'admin/audit',
      query: {'limit': limit},
      cancelToken: cancelToken,
    );
    return asJsonList(asJson(data)['items'])
        .map(AdminAuditEvent.fromJson)
        .toList(growable: false);
  }

  // ------------------------------------------------------------------- logo

  Future<LogoSummary> uploadLogo(
    String organizationId,
    Uint8List bytes, {
    required String mime,
    CancelToken? cancelToken,
  }) async => LogoSummary.fromJson(
    asJson(
      await _client.putBytes<dynamic>(
        '${_org(organizationId)}/logo',
        bytes,
        contentType: mime,
        cancelToken: cancelToken,
      ),
    ),
  );

  Future<DownloadedFile> downloadLogo(
    String organizationId, {
    String mime = 'image/png',
    CancelToken? cancelToken,
  }) => _client.download(
    '${_org(organizationId)}/logo',
    fallbackFilename: mime == 'image/jpeg' ? 'logo.jpg' : 'logo.png',
    cancelToken: cancelToken,
  );

  Future<void> removeLogo(String organizationId, {CancelToken? cancelToken}) =>
      _client.delete('${_org(organizationId)}/logo', cancelToken: cancelToken);
}
