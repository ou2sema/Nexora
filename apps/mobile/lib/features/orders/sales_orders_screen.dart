import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class SalesOrdersScreen extends ConsumerStatefulWidget {
  const SalesOrdersScreen({super.key});

  @override
  ConsumerState<SalesOrdersScreen> createState() => _SalesOrdersScreenState();
}

class _SalesOrdersScreenState extends ConsumerState<SalesOrdersScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String? _status;
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
    final orders = ref.watch(
      salesOrdersProvider((search: _search, status: _status, page: _page)),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.moreSalesOrders),
        actions: [
          IconButton(
            tooltip: l10n.ordersNewSale,
            onPressed: () => context.push('/orders/sales/new'),
            icon: const Icon(Icons.add_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SearchField(
              hint: l10n.ordersSearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: DropdownButtonFormField<String?>(
              initialValue: _status,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.ordersFilterStatus),
              items: [
                DropdownMenuItem(value: null, child: Text(l10n.commonAll)),
                for (final status in SalesOrderStatus.values)
                  DropdownMenuItem(
                    value: status.name,
                    child: Text(salesOrderStatusLabel(l10n, status)),
                  ),
              ],
              onChanged: (value) => setState(() {
                _status = value;
                _page = 1;
              }),
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                salesOrdersProvider((
                  search: _search,
                  status: _status,
                  page: _page,
                )).future,
              ),
              child: orders.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: l10n.commonEmpty,
                            message: l10n.ordersNoOrders,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final order in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _SalesOrderRow(
                                order: order,
                                onTap: () =>
                                    context.push('/orders/sales/${order.id}'),
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
                  onRetry: () => ref.invalidate(salesOrdersProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SalesOrderRow extends StatelessWidget {
  const _SalesOrderRow({required this.order, required this.onTap});

  final SalesOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  order.number,
                  style: context.texts.titleSmall,
                  textDirection: TextDirection.ltr,
                ),
              ),
              StatusPill(
                label: salesOrderStatusLabel(l10n, order.status),
                tone: salesOrderStatusTone(order.status),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(order.customerName, style: context.texts.bodyMedium),
          Text(
            '${order.warehouseCode}/${order.locationCode} · '
            '${l10n.ordersLines(order.lineCount)}',
            style: context.texts.bodySmall,
          ),
          const SizedBox(height: NexoraSpace.xs),
          Row(
            children: [
              Text(formatDate(order.createdAt), style: context.texts.bodySmall),
              const Spacer(),
              QuantityText(order.totalQuantity, style: context.texts.bodySmall),
              const SizedBox(width: NexoraSpace.xs),
              Text(l10n.commonUnits, style: context.texts.bodySmall),
            ],
          ),
        ],
      ),
    );
  }
}
