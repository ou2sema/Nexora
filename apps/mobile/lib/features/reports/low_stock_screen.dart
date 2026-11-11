import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/providers.dart';

class LowStockScreen extends ConsumerStatefulWidget {
  const LowStockScreen({super.key});

  @override
  ConsumerState<LowStockScreen> createState() => _LowStockScreenState();
}

class _LowStockScreenState extends ConsumerState<LowStockScreen> {
  String? _warehouseId;
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final warehouses = ref.watch(warehousesProvider);
    final items = ref.watch(
      lowStockProvider((warehouseId: _warehouseId, page: _page)),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.reportsLowStockTitle)),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: warehouses.when(
              data: (rows) => ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                scrollDirection: Axis.horizontal,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(l10n.commonAllWarehouses),
                      selected: _warehouseId == null,
                      onSelected: (_) => setState(() {
                        _warehouseId = null;
                        _page = 1;
                      }),
                    ),
                  ),
                  for (final warehouse in rows)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(warehouse.code),
                        selected: _warehouseId == warehouse.id,
                        onSelected: (_) => setState(() {
                          _warehouseId = warehouse.id;
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
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                lowStockProvider((warehouseId: _warehouseId, page: _page))
                    .future,
              ),
              child: items.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.check_circle_outline_rounded,
                            title: l10n.reportsNoLowStock,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        children: [
                          for (final item in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: NexoraCard(
                                onTap: () =>
                                    context.push('/products/${item.productId}'),
                                padding: const EdgeInsets.all(NexoraSpace.md),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.productName,
                                            style: context.texts.titleSmall,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          Text(
                                            [
                                              item.sku,
                                              ?item.categoryName,
                                            ].join(' · '),
                                            style: context.texts.bodySmall,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(
                                            height: NexoraSpace.xs,
                                          ),
                                          Text(
                                            '${l10n.inventoryOnHandShort} '
                                            '${formatQuantity(item.onHand)} · '
                                            '${l10n.reportsAvailable} '
                                            '${formatQuantity(item.available)} · '
                                            '${l10n.inventoryReorderLevel} '
                                            '${formatQuantity(item.reorderThreshold)}',
                                            style: context.texts.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: NexoraSpace.sm),
                                    StatusPill(
                                      label: l10n.reportsShortfall,
                                      tone: item.shortfall > 0
                                          ? PillTone.danger
                                          : PillTone.warning,
                                    ),
                                    const SizedBox(width: NexoraSpace.xs),
                                    QuantityText(
                                      item.shortfall,
                                      style: context.texts.titleSmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ListPager(
                            page: page.page,
                            pages: page.pageCount,
                            onPrevious: _page > 1
                                ? () => setState(() => _page--)
                                : null,
                            onNext: page.hasMore
                                ? () => setState(() => _page++)
                                : null,
                          ),
                        ],
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  onRetry: () => ref.invalidate(lowStockProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
