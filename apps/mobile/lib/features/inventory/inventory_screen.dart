import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/providers.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String? _categoryId;
  int _page = 1;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() {
        _search = value.trim();
        _page = 1;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final categories = ref.watch(categoriesProvider);
    final products = ref.watch(
      productsProvider((
        search: _search,
        status: null,
        categoryId: _categoryId,
        page: _page,
      )),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.inventoryTitle),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.commonNew,
              onPressed: () => context.push('/products/new'),
              icon: const Icon(Icons.add_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: SearchField(
              hint: l10n.inventorySearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          SizedBox(
            height: 40,
            child: categories.when(
              data: (items) => ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(l10n.commonAll),
                      selected: _categoryId == null,
                      onSelected: (_) => setState(() {
                        _categoryId = null;
                        _page = 1;
                      }),
                    ),
                  ),
                  for (final category in items)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(category.name),
                        selected: _categoryId == category.id,
                        onSelected: (_) => setState(() {
                          _categoryId = category.id;
                          _page = 1;
                        }),
                      ),
                    ),
                ],
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: NexoraSpace.sm),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                productsProvider((
                  search: _search,
                  status: null,
                  categoryId: _categoryId,
                  page: _page,
                )).future,
              ),
              child: products.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.inventory_2_outlined,
                            title: l10n.inventoryNoProducts,
                            actionLabel: role.canWrite ? l10n.commonNew : null,
                            onAction: role.canWrite
                                ? () => context.push('/products/new')
                                : null,
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        itemCount: page.items.length + 1,
                        itemBuilder: (context, index) {
                          if (index == page.items.length) {
                            return ListPager(
                              page: page.page,
                              pages: page.pageCount,
                              onPrevious: _page > 1
                                  ? () => setState(() => _page--)
                                  : null,
                              onNext: page.hasMore
                                  ? () => setState(() => _page++)
                                  : null,
                            );
                          }
                          final product = page.items[index];
                          return Padding(
                            padding: const EdgeInsets.only(
                              bottom: NexoraSpace.sm,
                            ),
                            child: _ProductRow(
                              product: product,
                              onTap: () =>
                                  context.push('/products/${product.id}'),
                            ),
                          );
                        },
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  onRetry: () => ref.invalidate(productsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: context.colors.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              product.isSerialized
                  ? Icons.smartphone_outlined
                  : product.isIndividuallyTracked
                  ? Icons.qr_code_2_rounded
                  : Icons.widgets_outlined,
              color: context.colors.primary,
            ),
          ),
          const SizedBox(width: NexoraSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  [product.sku, ?product.categoryName].join(' · '),
                  style: context.texts.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (product.isSerialized)
            StatusPill(label: l10n.inventorySerialized, tone: PillTone.primary)
          else if (product.isIndividuallyTracked)
            StatusPill(
              label: l10n.inventoryIndividuallyTracked,
              tone: PillTone.primary,
            ),
          const SizedBox(width: NexoraSpace.sm),
          if (product.salePriceMinor != null)
            MoneyText(product.salePriceMinor!, style: context.texts.titleSmall)
          else
            Text('—', style: context.texts.bodySmall),
        ],
      ),
    );
  }
}
