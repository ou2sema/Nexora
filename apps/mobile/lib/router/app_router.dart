import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/app_providers.dart';
import '../core/session/session_controller.dart';
import '../core/ui/failure_text.dart';
import '../core/ui/widgets.dart';
import '../data/models/catalog.dart';
import '../data/models/invoicing.dart';
import '../data/models/operations.dart';
import '../data/providers.dart';
import '../features/admin/admin_screen.dart';
import '../features/auth/create_organization_screen.dart';
import '../features/auth/sign_in_screen.dart';
import '../features/auth/welcome_screen.dart';
import '../features/branding/branding_screen.dart';
import '../features/devices/device_detail_screen.dart';
import '../features/devices/device_form_screen.dart';
import '../features/devices/devices_screen.dart';
import '../features/home/home_screen.dart';
import '../features/inventory/inventory_screen.dart';
import '../features/inventory/product_detail_screen.dart';
import '../features/inventory/product_editor_screen.dart';
import '../features/invoices/invoice_detail_screen.dart';
import '../features/invoices/invoices_screen.dart';
import '../features/more/more_screen.dart';
import '../features/orders/purchase_order_detail_screen.dart';
import '../features/orders/purchase_order_form_screen.dart';
import '../features/orders/purchase_orders_screen.dart';
import '../features/orders/purchase_receipt_screen.dart';
import '../features/orders/purchase_return_detail_screen.dart';
import '../features/orders/purchase_return_form_screen.dart';
import '../features/orders/sales_order_detail_screen.dart';
import '../features/orders/sales_order_form_screen.dart';
import '../features/orders/sales_orders_screen.dart';
import '../features/orders/sales_return_detail_screen.dart';
import '../features/orders/sales_return_form_screen.dart';
import '../features/partners/customer_form_screen.dart';
import '../features/partners/customers_screen.dart';
import '../features/partners/supplier_form_screen.dart';
import '../features/partners/suppliers_screen.dart';
import '../features/reports/low_stock_screen.dart';
import '../features/reports/reports_screen.dart';
import '../features/reports/supplier_performance_screen.dart';
import '../features/sale/sell_screen.dart';
import '../features/scan/scan_screen.dart';
import '../features/settings/catalog_settings_screen.dart';
import '../features/settings/connection_screen.dart';
import '../features/settings/warehouses_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/shell/boot_screen.dart';
import '../features/stock/count_detail_screen.dart';
import '../features/stock/count_form_screen.dart';
import '../features/stock/counts_screen.dart';
import '../features/stock/movement_form_screen.dart';
import '../features/stock/movements_screen.dart';
import '../features/stock/reconciliation_screen.dart';
import '../features/stock/reservation_form_screen.dart';
import '../features/stock/reservations_screen.dart';
import '../features/stock/stock_levels_screen.dart';
import '../features/stock/transfer_screen.dart';
import '../features/team/team_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

class _RouterRefresh extends ChangeNotifier {
  void notify() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh();
  ref.onDispose(refresh.dispose);
  ref.listen<SessionState>(sessionProvider, (previous, next) {
    if (previous?.phase != next.phase ||
        previous?.organizationId != next.organizationId) {
      refresh.notify();
    }
  });

  final router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/boot',
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final location = state.matchedLocation;

      // The API address must be reachable before anyone signs in: a device
      // whose build points nowhere would otherwise have no way in.
      if (location == '/connection') return null;

      switch (session.phase) {
        case SessionPhase.starting:
        case SessionPhase.loading:
        case SessionPhase.failed:
          return location == '/boot' ? null : '/boot';
        case SessionPhase.signedOut:
          return location == '/sign-in' ? null : '/sign-in';
        case SessionPhase.needsOrganization:
          const allowed = {
            '/welcome',
            '/welcome/create',
            '/organizations/new',
            '/admin',
            '/admin/new-organization',
          };
          return allowed.contains(location) ? null : '/welcome';
        case SessionPhase.ready:
          if (location == '/boot' ||
              location == '/sign-in' ||
              location == '/welcome' ||
              location == '/welcome/create') {
            return '/home';
          }
          return null;
      }
    },
    routes: [
      GoRoute(path: '/boot', builder: (_, _) => const BootScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/connection', builder: (_, _) => const ConnectionScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(
        path: '/welcome/create',
        builder: (_, _) => const CreateOrganizationScreen(),
      ),
      GoRoute(
        path: '/organizations/new',
        builder: (_, _) => const CreateOrganizationScreen(),
      ),
      GoRoute(path: '/admin', builder: (_, _) => const AdminScreen()),
      GoRoute(
        path: '/admin/new-organization',
        builder: (_, _) => const CreateOrganizationScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/inventory',
                builder: (_, _) => const InventoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/scan', builder: (_, _) => const ScanScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/sell', builder: (_, _) => const SellScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
            ],
          ),
        ],
      ),

      // ----------------------------------------------------------- inventory
      GoRoute(
        path: '/products/new',
        builder: (_, _) => const ProductEditorScreen(),
      ),
      GoRoute(
        path: '/products/:id',
        builder: (_, state) =>
            ProductDetailScreen(productId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/products/:id/edit',
        builder: (_, state) {
          final extra = state.extra;
          if (extra is Product) return ProductEditorScreen(initial: extra);
          return _ProductEditLoader(productId: state.pathParameters['id']!);
        },
      ),

      // --------------------------------------------------------------- stock
      GoRoute(
        path: '/stock/levels',
        builder: (_, _) => const StockLevelsScreen(),
      ),
      GoRoute(
        path: '/stock/movements',
        builder: (_, _) => const StockMovementsScreen(),
      ),
      GoRoute(
        path: '/stock/movements/new',
        builder: (_, state) => MovementFormScreen(
          initialType: state.uri.queryParameters['type'],
          productId: state.uri.queryParameters['productId'],
        ),
      ),
      GoRoute(
        path: '/stock/transfer',
        builder: (_, state) =>
            TransferScreen(productId: state.uri.queryParameters['productId']),
      ),
      GoRoute(
        path: '/stock/reservations',
        builder: (_, _) => const ReservationsScreen(),
      ),
      GoRoute(
        path: '/stock/reservations/new',
        builder: (_, state) => ReservationFormScreen(
          productId: state.uri.queryParameters['productId'],
        ),
      ),
      GoRoute(
        path: '/stock/reconciliation',
        builder: (_, _) => const ReconciliationScreen(),
      ),
      GoRoute(
        path: '/stock/counts',
        builder: (_, _) => const StockCountsScreen(),
      ),
      GoRoute(
        path: '/stock/counts/new',
        builder: (_, _) => const StockCountFormScreen(),
      ),
      GoRoute(
        path: '/stock/counts/:id',
        builder: (_, state) =>
            StockCountScreen(countId: state.pathParameters['id']!),
      ),

      // ------------------------------------------------------------- devices
      GoRoute(
        path: '/devices',
        builder: (_, state) =>
            DevicesScreen(productId: state.uri.queryParameters['productId']),
      ),
      GoRoute(
        path: '/devices/new',
        builder: (_, state) =>
            DeviceFormScreen(productId: state.uri.queryParameters['productId']),
      ),
      GoRoute(
        path: '/devices/:id',
        builder: (_, state) =>
            DeviceDetailScreen(deviceId: state.pathParameters['id']!),
      ),

      // ------------------------------------------------- purchase and sales
      GoRoute(
        path: '/orders/purchases',
        builder: (_, _) => const PurchaseOrdersScreen(),
      ),
      GoRoute(
        path: '/orders/purchases/new',
        builder: (_, _) => const PurchaseOrderFormScreen(),
      ),
      GoRoute(
        path: '/orders/purchases/:id',
        builder: (_, state) =>
            PurchaseOrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/purchases/:id/receive',
        builder: (_, state) =>
            PurchaseReceiptScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/purchases/:id/returns/new',
        builder: (_, state) =>
            PurchaseReturnFormScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/purchases/:id/returns/:returnId',
        builder: (_, state) => PurchaseReturnDetailScreen(
          orderId: state.pathParameters['id']!,
          returnId: state.pathParameters['returnId']!,
        ),
      ),
      GoRoute(
        path: '/orders/sales',
        builder: (_, _) => const SalesOrdersScreen(),
      ),
      GoRoute(
        path: '/orders/sales/new',
        builder: (_, _) => const SalesOrderFormScreen(),
      ),
      GoRoute(
        path: '/orders/sales/:id',
        builder: (_, state) =>
            SalesOrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/sales/:id/returns/new',
        builder: (_, state) =>
            SalesReturnFormScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/sales/:id/returns/:returnId',
        builder: (_, state) => SalesReturnDetailScreen(
          orderId: state.pathParameters['id']!,
          returnId: state.pathParameters['returnId']!,
        ),
      ),

      // ------------------------------------------------------------ invoices
      GoRoute(path: '/invoices', builder: (_, _) => const InvoicesScreen()),
      GoRoute(
        path: '/invoices/:id',
        builder: (_, state) =>
            InvoiceDetailScreen(invoiceId: state.pathParameters['id']!),
      ),

      // ------------------------------------------------------------ partners
      GoRoute(path: '/suppliers', builder: (_, _) => const SuppliersScreen()),
      GoRoute(
        path: '/suppliers/new',
        builder: (_, _) => const SupplierFormScreen(),
      ),
      GoRoute(
        path: '/suppliers/:id/edit',
        builder: (_, state) {
          final extra = state.extra;
          if (extra is Supplier) return SupplierFormScreen(initial: extra);
          return _SupplierEditLoader(supplierId: state.pathParameters['id']!);
        },
      ),
      GoRoute(path: '/customers', builder: (_, _) => const CustomersScreen()),
      GoRoute(
        path: '/customers/new',
        builder: (_, _) => const CustomerFormScreen(),
      ),
      GoRoute(
        path: '/customers/:id/edit',
        builder: (_, state) {
          final extra = state.extra;
          if (extra is Customer) return CustomerFormScreen(initial: extra);
          return _CustomerEditLoader(customerId: state.pathParameters['id']!);
        },
      ),

      // ------------------------------------------------------------- reports
      GoRoute(path: '/reports', builder: (_, _) => const ReportsScreen()),
      GoRoute(
        path: '/reports/low-stock',
        builder: (_, _) => const LowStockScreen(),
      ),
      GoRoute(
        path: '/reports/supplier-performance',
        builder: (_, _) => const SupplierPerformanceScreen(),
      ),

      // ------------------------------------------------------ organization
      GoRoute(path: '/team', builder: (_, _) => const TeamScreen()),
      GoRoute(path: '/branding', builder: (_, _) => const BrandingScreen()),
      GoRoute(
        path: '/settings/warehouses',
        builder: (_, _) => const WarehousesScreen(),
      ),
      GoRoute(
        path: '/settings/catalog',
        builder: (_, _) => const CatalogSettingsScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: Text(context.l10n.commonError)),
      body: EmptyState(
        icon: Icons.explore_off_rounded,
        title: context.l10n.commonNoResults,
        message: state.uri.toString(),
        actionLabel: context.l10n.navHome,
        onAction: () => context.go('/home'),
      ),
    ),
  );
  ref.onDispose(router.dispose);
  return router;
});

class _ProductEditLoader extends ConsumerWidget {
  const _ProductEditLoader({required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref.watch(productProvider(productId));
    return product.when(
      data: (product) => ProductEditorScreen(initial: product),
      loading: () => _LoaderScaffold(child: const CircularProgressIndicator()),
      error: (error, _) => _LoaderScaffold(
        child: FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(productProvider(productId)),
        ),
      ),
    );
  }
}

class _SupplierEditLoader extends ConsumerWidget {
  const _SupplierEditLoader({required this.supplierId});

  final String supplierId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliers = ref.watch(
      suppliersProvider((search: '', isActive: null, page: 1)),
    );
    return suppliers.when(
      data: (page) {
        for (final item in page.items) {
          if (item.id == supplierId) return SupplierFormScreen(initial: item);
        }
        return _LoaderScaffold(
          child: EmptyState(
            icon: Icons.search_off_rounded,
            title: context.l10n.commonNoResults,
          ),
        );
      },
      loading: () => _LoaderScaffold(child: const CircularProgressIndicator()),
      error: (error, _) => _LoaderScaffold(
        child: FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(suppliersProvider),
        ),
      ),
    );
  }
}

class _CustomerEditLoader extends ConsumerWidget {
  const _CustomerEditLoader({required this.customerId});

  final String customerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customers = ref.watch(
      customersProvider((search: '', isActive: null, page: 1)),
    );
    return customers.when(
      data: (page) {
        for (final item in page.items) {
          if (item.id == customerId) return CustomerFormScreen(initial: item);
        }
        return _LoaderScaffold(
          child: EmptyState(
            icon: Icons.search_off_rounded,
            title: context.l10n.commonNoResults,
          ),
        );
      },
      loading: () => _LoaderScaffold(child: const CircularProgressIndicator()),
      error: (error, _) => _LoaderScaffold(
        child: FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(customersProvider),
        ),
      ),
    );
  }
}

class _LoaderScaffold extends StatelessWidget {
  const _LoaderScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(context.l10n.commonEdit)),
    body: child,
  );
}
