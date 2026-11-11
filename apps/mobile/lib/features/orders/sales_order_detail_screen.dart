import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class SalesOrderDetailScreen extends ConsumerStatefulWidget {
  const SalesOrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<SalesOrderDetailScreen> createState() =>
      _SalesOrderDetailScreenState();
}

class _SalesOrderDetailScreenState
    extends ConsumerState<SalesOrderDetailScreen> {
  final _guard = IdempotencyGuard();
  bool _busy = false;

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _invalidateAll() {
    ref.invalidate(salesOrderProvider(widget.orderId));
    ref.invalidate(salesOrdersProvider);
    ref.invalidate(salesReturnsProvider(widget.orderId));
    ref.invalidate(stockLevelsProvider);
    ref.invalidate(stockSummaryProvider);
    ref.invalidate(reservationsProvider);
  }

  Future<void> _act<T>(
    Future<T> Function(String key) action,
    String confirmation,
  ) async {
    final l10n = context.l10n;
    if (confirmation.isNotEmpty) {
      final confirmed = await _confirm(confirmation, confirmation);
      if (confirmed != true) return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(action);
      _invalidateAll();
      if (mounted) _show(l10n.commonSuccess);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmAction(String action) async {
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    final api = ref.read(nexoraApiProvider);
    switch (action) {
      case 'confirm':
        await _act(
          (key) => api.confirmSalesOrder(
            organizationId,
            widget.orderId,
            idempotencyKey: key,
          ),
          '',
        );
      case 'fulfil':
        await _act(
          (key) => api.fulfilSalesOrder(
            organizationId,
            widget.orderId,
            idempotencyKey: key,
          ),
          '',
        );
      case 'cancel':
        await _act(
          (key) => api.cancelSalesOrder(
            organizationId,
            widget.orderId,
            idempotencyKey: key,
          ),
          context.l10n.ordersCancelOrder,
        );
    }
  }

  Future<bool?> _confirm(String title, String action) => showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(context.l10n.commonCancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(action),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final value = ref.watch(salesOrderProvider(widget.orderId));
    final returns = ref.watch(salesReturnsProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.ordersSalesOrder),
        actions: [
          IconButton(
            tooltip: l10n.commonRefresh,
            onPressed: () => ref.invalidate(salesOrderProvider(widget.orderId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(salesOrderProvider(widget.orderId)),
        ),
        data: (detail) {
          final order = detail.order;
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(salesOrderProvider(widget.orderId).future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                NexoraCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              order.number,
                              style: context.texts.titleMedium,
                              textDirection: TextDirection.ltr,
                            ),
                          ),
                          StatusPill(
                            label: salesOrderStatusLabel(l10n, order.status),
                            tone: salesOrderStatusTone(order.status),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      KeyValueRow(
                        label: l10n.ordersCustomer,
                        value: order.customerName,
                      ),
                      if (order.customerPhone != null)
                        KeyValueRow(
                          label: l10n.customersPhone,
                          value: order.customerPhone!,
                        ),
                      if (order.customerEmail != null)
                        KeyValueRow(
                          label: l10n.commonEmail,
                          value: order.customerEmail!,
                        ),
                      KeyValueRow(
                        label: l10n.ordersDeliverTo,
                        value: '${order.warehouseCode}/${order.locationCode}',
                      ),
                      KeyValueRow(
                        label: l10n.commonDate,
                        value: formatDate(order.createdAt),
                      ),
                      if (order.confirmedAt != null)
                        KeyValueRow(
                          label: l10n.ordersStatusConfirmed,
                          value: formatDateTime(order.confirmedAt),
                        ),
                      if (order.fulfilledAt != null)
                        KeyValueRow(
                          label: l10n.ordersStatusFulfilled,
                          value: formatDateTime(order.fulfilledAt),
                        ),
                      if (order.reference != null)
                        KeyValueRow(
                          label: l10n.ordersReference,
                          value: order.reference!,
                        ),
                      if (order.notes != null)
                        KeyValueRow(
                          label: l10n.ordersNotes,
                          value: order.notes!,
                        ),
                      KeyValueRow(
                        label: l10n.commonTotal,
                        value:
                            '${formatQuantity(order.totalQuantity)} ${l10n.commonUnits}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.ordersLines(detail.lines.length)),
                for (final line in detail.lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                    child: _SalesLineRow(line: line),
                  ),
                if (role.canWrite) ...[
                  const SizedBox(height: NexoraSpace.lg),
                  if (order.status == SalesOrderStatus.draft)
                    FilledButton(
                      onPressed: _busy ? null : () => _confirmAction('confirm'),
                      child: Text(l10n.ordersConfirmOrder),
                    ),
                  if (order.status == SalesOrderStatus.confirmed)
                    FilledButton.icon(
                      onPressed: _busy ? null : () => _confirmAction('fulfil'),
                      icon: const Icon(Icons.local_shipping_outlined),
                      label: Text(l10n.ordersFulfilOrder),
                    ),
                  if (order.status == SalesOrderStatus.fulfilled)
                    OutlinedButton.icon(
                      onPressed: _busy
                          ? null
                          : () => context.push(
                              '/orders/sales/${widget.orderId}/returns/new',
                            ),
                      icon: const Icon(Icons.assignment_return_outlined),
                      label: Text(l10n.ordersNewReturn),
                    ),
                  if (order.status == SalesOrderStatus.draft ||
                      order.status == SalesOrderStatus.confirmed) ...[
                    const SizedBox(height: NexoraSpace.sm),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : () => _confirmAction('cancel'),
                      icon: const Icon(Icons.block_rounded),
                      label: Text(l10n.ordersCancelOrder),
                    ),
                  ],
                ],
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.ordersReturns),
                returns.when(
                  data: (page) => page.items.isEmpty
                      ? NexoraCard(
                          child: Text(
                            l10n.commonEmpty,
                            style: context.texts.bodyMedium,
                          ),
                        )
                      : Column(
                          children: [
                            for (final item in page.items)
                              Padding(
                                padding: const EdgeInsets.only(
                                  bottom: NexoraSpace.sm,
                                ),
                                child: _SalesReturnRow(
                                  item: item,
                                  onTap: () => context.push(
                                    '/orders/sales/${widget.orderId}/returns/${item.id}',
                                  ),
                                ),
                              ),
                          ],
                        ),
                  loading: () => const Center(
                    child: Padding(
                      padding: EdgeInsets.all(NexoraSpace.lg),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                  error: (error, _) => FailureView(
                    failure: failureOf(error),
                    compact: true,
                    onRetry: () =>
                        ref.invalidate(salesReturnsProvider(widget.orderId)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SalesLineRow extends StatelessWidget {
  const _SalesLineRow({required this.line});

  final SalesOrderLine line;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  line.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (line.unitPriceMinor != null)
                MoneyText(line.unitPriceMinor!, withCode: false),
            ],
          ),
          Text(
            line.productSku,
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(
            '${l10n.commonQuantity} ${formatQuantity(line.quantity)} · '
            '${l10n.ordersQuantityReturned} ${formatQuantity(line.quantityReturned)}',
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
        ],
      ),
    );
  }
}

class _SalesReturnRow extends StatelessWidget {
  const _SalesReturnRow({required this.item, required this.onTap});

  final SalesReturn item;
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
                  item.number,
                  style: context.texts.titleSmall,
                  textDirection: TextDirection.ltr,
                ),
                Text(
                  '${formatDate(item.createdAt)} · ${formatQuantity(item.totalQuantity)} '
                  '${l10n.commonUnits}',
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
          StatusPill(
            label: returnStatusLabel(l10n, item.status),
            tone: returnStatusTone(item.status),
          ),
        ],
      ),
    );
  }
}
