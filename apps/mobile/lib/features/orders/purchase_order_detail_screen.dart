import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class PurchaseOrderDetailScreen extends ConsumerStatefulWidget {
  const PurchaseOrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<PurchaseOrderDetailScreen> createState() =>
      _PurchaseOrderDetailScreenState();
}

class _PurchaseOrderDetailScreenState
    extends ConsumerState<PurchaseOrderDetailScreen> {
  final _guard = IdempotencyGuard();
  bool _busy = false;

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _invalidateAll() {
    ref.invalidate(purchaseOrderProvider(widget.orderId));
    ref.invalidate(purchaseOrdersProvider);
    ref.invalidate(purchaseReturnsProvider(widget.orderId));
    ref.invalidate(supplierPerformanceProvider);
  }

  Future<void> _markOrdered() async {
    final l10n = context.l10n;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .markPurchaseOrderOrdered(
              organizationId,
              widget.orderId,
              idempotencyKey: key,
            ),
      );
      _invalidateAll();
      if (mounted) _show(l10n.commonSuccess);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final l10n = context.l10n;
    final confirmed = await _confirm(
      l10n.ordersCancelOrder,
      l10n.ordersCancelOrder,
    );
    if (confirmed != true) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .cancelPurchaseOrder(
              organizationId,
              widget.orderId,
              idempotencyKey: key,
            ),
      );
      _invalidateAll();
      if (mounted) _show(l10n.commonSuccess);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
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
    final value = ref.watch(purchaseOrderProvider(widget.orderId));
    final returns = ref.watch(purchaseReturnsProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.ordersPurchaseOrder),
        actions: [
          IconButton(
            tooltip: l10n.ordersDownloadPdf,
            onPressed: () {
              final organizationId = ref.read(organizationIdProvider);
              if (organizationId == null) return;
              downloadDocument(
                context,
                () => ref
                    .read(nexoraApiProvider)
                    .purchaseOrderPdf(
                      organizationId,
                      widget.orderId,
                      locale: Localizations.localeOf(context).languageCode,
                    ),
              );
            },
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(purchaseOrderProvider(widget.orderId)),
        ),
        data: (detail) {
          final order = detail.order;
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(purchaseOrderProvider(widget.orderId).future),
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
                            label: purchaseOrderStatusLabel(l10n, order.status),
                            tone: purchaseOrderStatusTone(order.status),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      KeyValueRow(
                        label: l10n.ordersSupplier,
                        value: order.supplierName,
                      ),
                      KeyValueRow(
                        label: l10n.ordersDeliverTo,
                        value: '${order.warehouseCode}/${order.locationCode}',
                      ),
                      KeyValueRow(
                        label: l10n.commonDate,
                        value: formatDate(order.createdAt),
                      ),
                      if (order.expectedOn != null)
                        KeyValueRow(
                          label: l10n.ordersExpectedDate,
                          value: order.expectedOn!,
                        ),
                      if (order.orderedAt != null)
                        KeyValueRow(
                          label: l10n.ordersOrdered,
                          value: formatDateTime(order.orderedAt),
                        ),
                      if (order.receivedAt != null)
                        KeyValueRow(
                          label: l10n.ordersReceived,
                          value: formatDateTime(order.receivedAt),
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
                        label: l10n.ordersReceivingProgress,
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
                    child: _PurchaseLineRow(line: line),
                  ),
                if (role.canWrite &&
                    order.status != PurchaseOrderStatus.cancelled) ...[
                  const SizedBox(height: NexoraSpace.lg),
                  if (order.status == PurchaseOrderStatus.draft)
                    FilledButton(
                      onPressed: _busy ? null : _markOrdered,
                      child: Text(l10n.ordersMarkOrdered),
                    ),
                  if (order.isReceivable) ...[
                    FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () => context.push(
                              '/orders/purchases/${widget.orderId}/receive',
                            ),
                      icon: const Icon(Icons.inventory_rounded),
                      label: Text(l10n.ordersReceive),
                    ),
                    if (order.status == PurchaseOrderStatus.partiallyReceived ||
                        order.status == PurchaseOrderStatus.received) ...[
                      const SizedBox(height: NexoraSpace.sm),
                      OutlinedButton.icon(
                        onPressed: _busy
                            ? null
                            : () => context.push(
                                '/orders/purchases/${widget.orderId}/returns/new',
                              ),
                        icon: const Icon(Icons.assignment_return_outlined),
                        label: Text(l10n.ordersNewReturn),
                      ),
                    ],
                  ],
                  if (order.status != PurchaseOrderStatus.received &&
                      order.status != PurchaseOrderStatus.cancelled) ...[
                    const SizedBox(height: NexoraSpace.sm),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : _cancel,
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
                                child: _PurchaseReturnRow(
                                  item: item,
                                  onTap: () => context.push(
                                    '/orders/purchases/${widget.orderId}/returns/${item.id}',
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
                        ref.invalidate(purchaseReturnsProvider(widget.orderId)),
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

class _PurchaseLineRow extends StatelessWidget {
  const _PurchaseLineRow({required this.line});

  final PurchaseOrderLine line;

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
              if (line.unitCostMinor != null)
                MoneyText(line.unitCostMinor!, withCode: false),
            ],
          ),
          Text(
            line.productSku,
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(
            '${l10n.ordersQuantityOrdered} ${formatQuantity(line.quantityOrdered)} · '
            '${l10n.ordersQuantityReceived} ${formatQuantity(line.quantityReceived)} · '
            '${l10n.ordersQuantityReturned} ${formatQuantity(line.quantityReturned)}',
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
          if (line.quantityOutstanding > 0)
            Text(
              '${l10n.ordersRemaining} ${formatQuantity(line.quantityOutstanding)}',
              style: context.texts.bodySmall,
              textDirection: TextDirection.ltr,
            ),
        ],
      ),
    );
  }
}

class _PurchaseReturnRow extends StatelessWidget {
  const _PurchaseReturnRow({required this.item, required this.onTap});

  final PurchaseReturn item;
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
