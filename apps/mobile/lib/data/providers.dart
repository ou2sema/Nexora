import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/app_providers.dart';
import 'models/admin.dart';
import 'models/catalog.dart';
import 'models/devices.dart';
import 'models/invoicing.dart';
import 'models/json.dart';
import 'models/operations.dart';
import 'models/reports.dart';
import 'models/scanning.dart';
import 'models/stock.dart';
import 'models/team.dart';

String? _org(Ref ref) => ref.watch(organizationIdProvider);

final warehousesProvider = FutureProvider<List<Warehouse>>((ref) async {
  final organizationId = _org(ref);
  if (organizationId == null) return const [];
  return ref.watch(nexoraApiProvider).listWarehouses(organizationId);
});

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final organizationId = _org(ref);
  if (organizationId == null) return const [];
  return ref.watch(nexoraApiProvider).listCategories(organizationId);
});

final brandsProvider = FutureProvider<List<Brand>>((ref) async {
  final organizationId = _org(ref);
  if (organizationId == null) return const [];
  return ref.watch(nexoraApiProvider).listBrands(organizationId);
});

final stockSummaryProvider = FutureProvider<StockSummary>((ref) async {
  final organizationId = _org(ref);
  if (organizationId == null) {
    return const StockSummary(
      onHand: 0,
      reserved: 0,
      available: 0,
      locationCount: 0,
      productCount: 0,
    );
  }
  return ref.watch(nexoraApiProvider).stockSummary(organizationId);
});

typedef ProductQuery = ({
  String search,
  String? status,
  String? categoryId,
  int page,
});

final productsProvider = FutureProvider.autoDispose
    .family<Paged<Product>, ProductQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listProducts(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            status: query.status,
            categoryId: query.categoryId,
            page: query.page,
          );
    });

final productProvider = FutureProvider.autoDispose.family<Product, String>((
  ref,
  productId,
) async {
  final organizationId = _org(ref);
  if (organizationId == null) throw StateError('No organization selected');
  return ref.watch(nexoraApiProvider).getProduct(organizationId, productId);
});

final productStockProvider = FutureProvider.autoDispose
    .family<List<StockLevel>, String>((ref, productId) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      final page = await ref
          .watch(nexoraApiProvider)
          .listStockLevels(organizationId, productId: productId, pageSize: 100);
      return page.items;
    });

/// The first hundred rows behind a picker. The pickers also search, so an
/// organization with a longer catalog still finds the product by name or SKU.
final productOptionsProvider = FutureProvider.autoDispose
    .family<List<Product>, String>((ref, search) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      final page = await ref
          .watch(nexoraApiProvider)
          .listProducts(
            organizationId,
            search: search.isEmpty ? null : search,
            pageSize: 100,
          );
      return page.items;
    });

final customerOptionsProvider = FutureProvider.autoDispose
    .family<List<Customer>, String>((ref, search) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      final page = await ref
          .watch(nexoraApiProvider)
          .listCustomers(
            organizationId,
            search: search.isEmpty ? null : search,
            isActive: true,
            pageSize: 100,
          );
      return page.items;
    });

final supplierOptionsProvider = FutureProvider.autoDispose
    .family<List<Supplier>, String>((ref, search) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      final page = await ref
          .watch(nexoraApiProvider)
          .listSuppliers(
            organizationId,
            search: search.isEmpty ? null : search,
            isActive: true,
            pageSize: 100,
          );
      return page.items;
    });

typedef StockLevelsQuery = ({String search, String? warehouseId, int page});
final stockLevelsProvider = FutureProvider.autoDispose
    .family<Paged<StockLevel>, StockLevelsQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listStockLevels(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            warehouseId: query.warehouseId,
            page: query.page,
          );
    });

typedef MovementsQuery = ({
  int page,
  String? productId,
  String? warehouseId,
  String? type,
});

final movementsProvider = FutureProvider.autoDispose
    .family<Paged<StockMovement>, MovementsQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listMovements(
            organizationId,
            page: query.page,
            productId: query.productId,
            warehouseId: query.warehouseId,
            movementType: query.type,
          );
    });

final reservationsProvider =
    FutureProvider.autoDispose<Paged<StockReservation>>((ref) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref.watch(nexoraApiProvider).listReservations(organizationId);
    });

final reconciliationProvider =
    FutureProvider.autoDispose<List<StockReconciliationRow>>((ref) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      return ref.watch(nexoraApiProvider).reconciliation(organizationId);
    });

typedef DevicesQuery = ({
  String search,
  String? status,
  String? productId,
  int page,
});

final devicesProvider = FutureProvider.autoDispose
    .family<Paged<Device>, DevicesQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listDevices(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            status: query.status,
            productId: query.productId,
            page: query.page,
          );
    });

final deviceProvider = FutureProvider.autoDispose.family<Device, String>((
  ref,
  deviceId,
) async {
  final organizationId = _org(ref);
  if (organizationId == null) throw StateError('No organization selected');
  return ref.watch(nexoraApiProvider).getDevice(organizationId, deviceId);
});

final deviceEventsProvider = FutureProvider.autoDispose
    .family<List<DeviceEvent>, String>((ref, deviceId) async {
      final organizationId = _org(ref);
      if (organizationId == null) return const [];
      return ref
          .watch(nexoraApiProvider)
          .deviceEvents(organizationId, deviceId);
    });

typedef StockCountsQuery = ({String? status, int page});

final stockCountsProvider = FutureProvider.autoDispose
    .family<Paged<StockCountSummary>, StockCountsQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listStockCounts(
            organizationId,
            status: query.status,
            page: query.page,
          );
    });

final stockCountProvider = FutureProvider.autoDispose
    .family<StockCount, String>((ref, countId) async {
      final organizationId = _org(ref);
      if (organizationId == null) throw StateError('No organization selected');
      return ref
          .watch(nexoraApiProvider)
          .getStockCount(organizationId, countId);
    });

typedef SuppliersQuery = ({String search, bool? isActive, int page});

final suppliersProvider = FutureProvider.autoDispose
    .family<Paged<Supplier>, SuppliersQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listSuppliers(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            isActive: query.isActive,
            page: query.page,
          );
    });

typedef CustomersQuery = ({String search, bool? isActive, int page});

final customersProvider = FutureProvider.autoDispose
    .family<Paged<Customer>, CustomersQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listCustomers(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            isActive: query.isActive,
            page: query.page,
          );
    });

typedef PurchaseOrdersQuery = ({String search, String? status, int page});

final purchaseOrdersProvider = FutureProvider.autoDispose
    .family<Paged<PurchaseOrder>, PurchaseOrdersQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listPurchaseOrders(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            status: query.status,
            page: query.page,
          );
    });

final purchaseOrderProvider = FutureProvider.autoDispose
    .family<PurchaseOrderDetail, String>((ref, orderId) async {
      final organizationId = _org(ref);
      if (organizationId == null) throw StateError('No organization selected');
      return ref
          .watch(nexoraApiProvider)
          .getPurchaseOrder(organizationId, orderId);
    });

typedef SalesOrdersQuery = ({String search, String? status, int page});

final salesOrdersProvider = FutureProvider.autoDispose
    .family<Paged<SalesOrder>, SalesOrdersQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listSalesOrders(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            status: query.status,
            page: query.page,
          );
    });

final salesOrderProvider = FutureProvider.autoDispose
    .family<SalesOrderDetail, String>((ref, orderId) async {
      final organizationId = _org(ref);
      if (organizationId == null) throw StateError('No organization selected');
      return ref
          .watch(nexoraApiProvider)
          .getSalesOrder(organizationId, orderId);
    });

typedef InvoicesQuery = ({String search, String? paymentStatus, int page});

final invoicesProvider = FutureProvider.autoDispose
    .family<Paged<SalesInvoice>, InvoicesQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listInvoices(
            organizationId,
            search: query.search.isEmpty ? null : query.search,
            paymentStatus: query.paymentStatus,
            page: query.page,
          );
    });

final invoiceProvider = FutureProvider.autoDispose
    .family<SalesInvoiceDetail, String>((ref, invoiceId) async {
      final organizationId = _org(ref);
      if (organizationId == null) throw StateError('No organization selected');
      return ref.watch(nexoraApiProvider).getInvoice(organizationId, invoiceId);
    });

final purchaseReturnsProvider = FutureProvider.autoDispose
    .family<Paged<PurchaseReturn>, String>((ref, orderId) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listPurchaseReturns(organizationId, orderId);
    });

final salesReturnsProvider = FutureProvider.autoDispose
    .family<Paged<SalesReturn>, String>((ref, orderId) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .listSalesReturns(organizationId, orderId);
    });

// ---------------------------------------------------------------- reports

typedef OverviewQuery = ({String? warehouseId, int days});

final reportOverviewProvider = FutureProvider.autoDispose
    .family<ReportOverview, OverviewQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) {
        throw StateError('No organization selected');
      }
      final now = DateTime.now().toUtc();
      return ref
          .watch(nexoraApiProvider)
          .reportOverview(
            organizationId,
            warehouseId: query.warehouseId,
            from: now.subtract(Duration(days: query.days)).toIso8601String(),
            to: now.toIso8601String(),
          );
    });

typedef LowStockQuery = ({String? warehouseId, int page});

final lowStockProvider = FutureProvider.autoDispose
    .family<Paged<LowStockItem>, LowStockQuery>((ref, query) async {
      final organizationId = _org(ref);
      if (organizationId == null) return Paged.empty();
      return ref
          .watch(nexoraApiProvider)
          .lowStock(
            organizationId,
            warehouseId: query.warehouseId,
            page: query.page,
          );
    });

typedef SupplierPerformanceQuery = ({int days});

final supplierPerformanceProvider = FutureProvider.autoDispose
    .family<SupplierPerformanceResponse, SupplierPerformanceQuery>((
      ref,
      query,
    ) async {
      final organizationId = _org(ref);
      if (organizationId == null) throw StateError('No organization selected');
      final now = DateTime.now().toUtc();
      return ref
          .watch(nexoraApiProvider)
          .supplierPerformance(
            organizationId,
            from: now.subtract(Duration(days: query.days)).toIso8601String(),
            to: now.toIso8601String(),
          );
    });

// ------------------------------------------------------------------- team

final teamMembersProvider = FutureProvider.autoDispose<List<TeamMember>>((
  ref,
) async {
  final organizationId = _org(ref);
  if (organizationId == null) return const [];
  return ref.watch(nexoraApiProvider).teamMembers(organizationId);
});

final invitationsProvider = FutureProvider.autoDispose<List<Invitation>>((
  ref,
) async {
  final organizationId = _org(ref);
  if (organizationId == null) return const [];
  return ref.watch(nexoraApiProvider).invitations(organizationId);
});

// ------------------------------------------------------------------ admin

final adminOrganizationsProvider =
    FutureProvider.autoDispose<List<AdminOrganization>>(
      (ref) => ref.watch(nexoraApiProvider).adminOrganizations(),
    );

final adminAuditProvider = FutureProvider.autoDispose<List<AdminAuditEvent>>(
  (ref) => ref.watch(nexoraApiProvider).adminAudit(),
);
