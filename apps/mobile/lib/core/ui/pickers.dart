import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/catalog.dart';
import '../../data/models/invoicing.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';
import '../theme/nexora_theme.dart';
import 'widgets.dart';

typedef ShelfChoice = ({Warehouse warehouse, StorageLocation location});

/// A searchable sheet over a paged list kept by a provider family. The caller
/// supplies the item row; tapping it pops the chosen value.
class SearchPicker<T> extends ConsumerStatefulWidget {
  const SearchPicker({
    super.key,
    required this.title,
    required this.hint,
    required this.watch,
    required this.itemBuilder,
    this.filter,
    this.emptyMessage,
  });

  final String title;
  final String hint;
  final AsyncValue<List<T>> Function(WidgetRef ref, String query) watch;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final bool Function(T item)? filter;
  final String? emptyMessage;

  @override
  ConsumerState<SearchPicker<T>> createState() => _SearchPickerState<T>();
}

class _SearchPickerState<T> extends ConsumerState<SearchPicker<T>> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  void _retry() {
    // The family key is the query; invalidating the whole family refreshes it.
    ref.invalidate(productOptionsProvider);
    ref.invalidate(customerOptionsProvider);
    ref.invalidate(supplierOptionsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final value = widget.watch(ref, _query);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(widget.title, style: context.texts.titleLarge),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SearchField(
                hint: widget.hint,
                controller: _search,
                onChanged: _onSearchChanged,
              ),
            ),
            const SizedBox(height: NexoraSpace.sm),
            const Divider(height: 1),
            Expanded(
              child: AsyncPane(
                value: value,
                onRetry: _retry,
                builder: (items) {
                  final visible = widget.filter == null
                      ? items
                      : items.where(widget.filter!).toList(growable: false);
                  if (visible.isEmpty) {
                    return EmptyState(
                      icon: Icons.search_off_rounded,
                      title: l10n.commonNoResults,
                      message: widget.emptyMessage,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    itemCount: visible.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: NexoraSpace.xs),
                    itemBuilder: (context, index) =>
                        widget.itemBuilder(context, visible[index]),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<Product?> showProductPicker(
  BuildContext context, {
  bool onlySerialized = false,
  bool onlyNotSerialized = false,
}) => showModalBottomSheet<Product>(
  context: context,
  isScrollControlled: true,
  builder: (_) => SearchPicker<Product>(
    title: context.l10n.ordersSelectProduct,
    hint: context.l10n.commonSearch,
    watch: (ref, query) => ref.watch(productOptionsProvider(query)),
    filter: onlySerialized
        ? (product) => product.isSerialized
        : onlyNotSerialized
        ? (product) => !product.isSerialized
        : null,
    itemBuilder: (context, product) => ListTile(
      leading: const Icon(Icons.inventory_2_outlined),
      title: Text(product.name),
      subtitle: Text(product.sku, textDirection: TextDirection.ltr),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => Navigator.of(context).pop(product),
    ),
  ),
);

Future<Supplier?> showSupplierPicker(BuildContext context) =>
    showModalBottomSheet<Supplier>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SearchPicker<Supplier>(
        title: context.l10n.ordersSelectSupplier,
        hint: context.l10n.suppliersSearchHint,
        watch: (ref, query) => ref.watch(supplierOptionsProvider(query)),
        itemBuilder: (context, supplier) => ListTile(
          leading: const Icon(Icons.local_shipping_outlined),
          title: Text(supplier.name),
          subtitle: supplier.phone == null
              ? null
              : Text(supplier.phone!, textDirection: TextDirection.ltr),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.of(context).pop(supplier),
        ),
      ),
    );

Future<Customer?> showCustomerPicker(BuildContext context) =>
    showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SearchPicker<Customer>(
        title: context.l10n.saleSelectCustomer,
        hint: context.l10n.customersSearchHint,
        watch: (ref, query) => ref.watch(customerOptionsProvider(query)),
        itemBuilder: (context, customer) => ListTile(
          leading: const Icon(Icons.person_outline_rounded),
          title: Text(customer.name),
          subtitle: customer.phone == null
              ? null
              : Text(customer.phone!, textDirection: TextDirection.ltr),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.of(context).pop(customer),
        ),
      ),
    );

/// Warehouse then location. A warehouse with no active location stays closed
/// instead of offering a shelf that cannot hold stock.
Future<ShelfChoice?> showShelfPicker(
  BuildContext context, {
  String? title,
  String? excludeLocationId,
}) => showModalBottomSheet<ShelfChoice>(
  context: context,
  isScrollControlled: true,
  builder: (_) =>
      _ShelfSheet(title: title, excludeLocationId: excludeLocationId),
);

class ShelfField extends StatelessWidget {
  const ShelfField({
    super.key,
    required this.label,
    required this.choice,
    required this.onTap,
  });

  final String label;
  final ShelfChoice? choice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(Icons.warehouse_outlined, color: context.colors.primary),
          const SizedBox(width: NexoraSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: context.texts.bodySmall),
                Text(
                  choice == null
                      ? l10n.saleNeedShelf
                      : '${choice!.warehouse.code} · ${choice!.location.code}',
                  style: context.texts.titleSmall,
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _ShelfSheet extends ConsumerWidget {
  const _ShelfSheet({this.title, this.excludeLocationId});

  final String? title;
  final String? excludeLocationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final warehouses = ref.watch(warehousesProvider);
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.72,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Text(
              title ?? l10n.saleNeedShelf,
              style: context.texts.titleLarge,
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: AsyncPane(
              value: warehouses,
              onRetry: () => ref.invalidate(warehousesProvider),
              builder: (items) {
                if (items.isEmpty) {
                  return EmptyState(
                    icon: Icons.warehouse_outlined,
                    title: l10n.commonEmpty,
                    message: l10n.saleNeedShelf,
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 24),
                  children: [
                    for (final warehouse in items)
                      ExpansionTile(
                        leading: const Icon(Icons.warehouse_outlined),
                        title: Text('${warehouse.code} · ${warehouse.name}'),
                        subtitle: warehouse.city == null
                            ? null
                            : Text(warehouse.city!),
                        children: [
                          for (final location in warehouse.activeLocations)
                            if (location.id != excludeLocationId)
                              ListTile(
                                contentPadding:
                                    const EdgeInsetsDirectional.only(
                                      start: 32,
                                      end: 16,
                                    ),
                                leading: const Icon(Icons.shelves),
                                title: Text(location.display),
                                onTap: () => Navigator.of(context).pop((
                                  warehouse: warehouse,
                                  location: location,
                                )),
                              ),
                        ],
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
