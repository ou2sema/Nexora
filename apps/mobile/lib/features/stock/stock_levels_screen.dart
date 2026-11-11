import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/stock.dart';
import '../../data/providers.dart';

class StockLevelsScreen extends ConsumerStatefulWidget {
  const StockLevelsScreen({super.key});

  @override
  ConsumerState<StockLevelsScreen> createState() => _StockLevelsScreenState();
}

class _StockLevelsScreenState extends ConsumerState<StockLevelsScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String? _warehouseId;
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
    final warehouses =
        ref.watch(warehousesProvider).value ?? const <Warehouse>[];
    final levels = ref.watch(
      stockLevelsProvider((
        search: _search,
        warehouseId: _warehouseId,
        page: _page,
      )),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l10n.moreStockLevels)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SearchField(
              hint: l10n.inventorySearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: DropdownButtonFormField<String?>(
              initialValue: _warehouseId,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.commonWarehouse),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(l10n.commonAllWarehouses),
                ),
                for (final warehouse in warehouses)
                  DropdownMenuItem(
                    value: warehouse.id,
                    child: Text(
                      '${warehouse.code} · ${warehouse.name}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (value) => setState(() {
                _warehouseId = value;
                _page = 1;
              }),
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                stockLevelsProvider((
                  search: _search,
                  warehouseId: _warehouseId,
                  page: _page,
                )).future,
              ),
              child: levels.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.warehouse_outlined,
                            title: l10n.commonEmpty,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final level in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _StockLevelRow(
                                level: level,
                                onTap: () => context.push(
                                  '/products/${level.productId}',
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
                  onRetry: () => ref.invalidate(stockLevelsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StockLevelRow extends StatelessWidget {
  const _StockLevelRow({required this.level, required this.onTap});

  final StockLevel level;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  level.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${level.sku} · ${level.warehouseCode}/${level.locationCode}',
                  style: context.texts.bodySmall,
                  textDirection: TextDirection.ltr,
                ),
              ],
            ),
          ),
          const SizedBox(width: NexoraSpace.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              QuantityText(level.available, style: context.texts.titleMedium),
              Text(
                '${l10n.inventoryOnHandShort} ${formatQuantity(level.onHand)} · '
                '${l10n.inventoryReservedShort} ${formatQuantity(level.reserved)}',
                style: context.texts.bodySmall,
                textDirection: TextDirection.ltr,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
