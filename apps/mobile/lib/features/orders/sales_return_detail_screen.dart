import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class SalesReturnDetailScreen extends ConsumerStatefulWidget {
  const SalesReturnDetailScreen({
    super.key,
    required this.orderId,
    required this.returnId,
  });

  final String orderId;
  final String returnId;

  @override
  ConsumerState<SalesReturnDetailScreen> createState() =>
      _SalesReturnDetailScreenState();
}

class _SalesReturnDetailScreenState
    extends ConsumerState<SalesReturnDetailScreen> {
  final _guard = IdempotencyGuard();
  SalesReturnDetail? _detail;
  bool _loading = true;
  ApiException? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await ref
          .read(nexoraApiProvider)
          .getSalesReturn(organizationId, widget.orderId, widget.returnId);
      if (mounted) setState(() => _detail = detail);
    } catch (error) {
      if (mounted) setState(() => _error = failureOf(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _invalidateAll() {
    ref.invalidate(salesReturnsProvider(widget.orderId));
    ref.invalidate(salesOrderProvider(widget.orderId));
    ref.invalidate(salesOrdersProvider);
    ref.invalidate(stockLevelsProvider);
    ref.invalidate(stockSummaryProvider);
    ref.invalidate(movementsProvider);
    ref.invalidate(productStockProvider);
  }

  Future<void> _act(
    Future<void> Function(String key) action,
    String success,
  ) async {
    final l10n = context.l10n;
    final confirmed = await _confirm(success, success);
    if (confirmed != true) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(action);
      _invalidateAll();
      if (mounted) {
        _show(success);
        await _load();
      }
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
    final detail = _detail;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersReturns)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? FailureView(failure: _error!, onRetry: _load)
          : detail == null
          ? const SizedBox.shrink()
          : RefreshIndicator(
              onRefresh: _load,
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
                                detail.returnOrder.number,
                                style: context.texts.titleMedium,
                                textDirection: TextDirection.ltr,
                              ),
                            ),
                            StatusPill(
                              label: returnStatusLabel(
                                l10n,
                                detail.returnOrder.status,
                              ),
                              tone: returnStatusTone(detail.returnOrder.status),
                            ),
                          ],
                        ),
                        const SizedBox(height: NexoraSpace.sm),
                        KeyValueRow(
                          label: l10n.ordersSalesOrder,
                          value: detail.returnOrder.salesOrderNumber,
                        ),
                        KeyValueRow(
                          label: l10n.ordersCustomer,
                          value: detail.returnOrder.customerName,
                        ),
                        KeyValueRow(
                          label: l10n.commonLocation,
                          value:
                              '${detail.returnOrder.warehouseCode}/${detail.returnOrder.locationCode}',
                        ),
                        KeyValueRow(
                          label: l10n.commonReason,
                          value: detail.returnOrder.reason,
                        ),
                        if (detail.returnOrder.reference != null)
                          KeyValueRow(
                            label: l10n.ordersReference,
                            value: detail.returnOrder.reference!,
                          ),
                        KeyValueRow(
                          label: l10n.commonDate,
                          value: formatDate(detail.returnOrder.createdAt),
                        ),
                        if (detail.returnOrder.postedAt != null)
                          KeyValueRow(
                            label: l10n.ordersStatusPosted,
                            value: formatDateTime(detail.returnOrder.postedAt),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: NexoraSpace.xl),
                  SectionHeader(title: l10n.ordersLines(detail.lines.length)),
                  for (final line in detail.lines)
                    Padding(
                      padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                      child: NexoraCard(
                        padding: const EdgeInsets.all(NexoraSpace.md),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    line.productName,
                                    style: context.texts.titleSmall,
                                  ),
                                  Text(
                                    line.productSku,
                                    style: context.texts.bodySmall,
                                    textDirection: TextDirection.ltr,
                                  ),
                                ],
                              ),
                            ),
                            QuantityText(
                              line.quantity,
                              style: context.texts.titleMedium,
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (role.canWrite &&
                      detail.returnOrder.status == ReturnStatus.draft) ...[
                    const SizedBox(height: NexoraSpace.lg),
                    FilledButton(
                      onPressed: _busy
                          ? null
                          : () {
                              final organizationId = ref.read(
                                organizationIdProvider,
                              );
                              if (organizationId == null) return;
                              _act(
                                (key) => ref
                                    .read(nexoraApiProvider)
                                    .postSalesReturn(
                                      organizationId,
                                      widget.orderId,
                                      widget.returnId,
                                      idempotencyKey: key,
                                    ),
                                l10n.ordersReturnPosted,
                              );
                            },
                      child: Text(l10n.ordersPostReturn),
                    ),
                    const SizedBox(height: NexoraSpace.sm),
                    OutlinedButton(
                      onPressed: _busy
                          ? null
                          : () {
                              final organizationId = ref.read(
                                organizationIdProvider,
                              );
                              if (organizationId == null) return;
                              _act(
                                (key) => ref
                                    .read(nexoraApiProvider)
                                    .cancelSalesReturn(
                                      organizationId,
                                      widget.orderId,
                                      widget.returnId,
                                      idempotencyKey: key,
                                    ),
                                l10n.ordersCancelReturn,
                              );
                            },
                      child: Text(l10n.ordersCancelReturn),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
