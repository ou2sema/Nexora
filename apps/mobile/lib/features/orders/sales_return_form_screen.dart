import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/drafts.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class SalesReturnFormScreen extends ConsumerStatefulWidget {
  const SalesReturnFormScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<SalesReturnFormScreen> createState() =>
      _SalesReturnFormScreenState();
}

class _SalesReturnFormScreenState extends ConsumerState<SalesReturnFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _guard = IdempotencyGuard();
  final _reason = TextEditingController();
  final _reference = TextEditingController();
  final _quantities = <String, TextEditingController>{};
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    _reference.dispose();
    for (final controller in _quantities.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _quantityFor(SalesOrderLine line) =>
      _quantities.putIfAbsent(
        line.id,
        () => TextEditingController(
          text: formatQuantity(line.quantity - line.quantityReturned),
        ),
      );

  Future<void> _save(SalesOrderDetail detail) async {
    final l10n = context.l10n;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final lines = <SalesReturnLineDraft>[];
    for (final line in detail.lines) {
      final available = line.quantity - line.quantityReturned;
      if (available <= 0) continue;
      final raw = _quantityFor(line).text.trim();
      if (raw.isEmpty) continue;
      final quantity = Money.parseQuantity(raw);
      if (quantity == null || quantity > available) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.commonInvalidNumber)));
        return;
      }
      lines.add(
        SalesReturnLineDraft(salesOrderLineId: line.id, quantity: quantity),
      );
    }
    if (lines.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.ordersAtLeastOneLine)));
      return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      final result = await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .createSalesReturn(
              organizationId,
              widget.orderId,
              SalesReturnDraft(
                reason: _reason.text.trim(),
                reference: _reference.text.trim().isEmpty
                    ? null
                    : _reference.text.trim(),
                lines: lines,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(salesReturnsProvider(widget.orderId));
      ref.invalidate(salesOrderProvider(widget.orderId));
      ref.invalidate(salesOrdersProvider);
      if (!mounted) return;
      context.pushReplacement(
        '/orders/sales/${widget.orderId}/returns/${result.returnId}',
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(l10n, failureOf(error)))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final value = ref.watch(salesOrderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersNewReturn)),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(salesOrderProvider(widget.orderId)),
        ),
        data: (detail) {
          final returnable = detail.lines
              .where((line) => line.quantity - line.quantityReturned > 0)
              .toList(growable: false);
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Text(
                  '${detail.order.number} · ${detail.order.customerName}',
                  style: context.texts.titleMedium,
                  textDirection: TextDirection.ltr,
                ),
                const SizedBox(height: NexoraSpace.lg),
                TextFormField(
                  controller: _reason,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: l10n.ordersReturnReason,
                  ),
                  validator: (value) {
                    final text = (value ?? '').trim();
                    if (text.length < 3) return l10n.commonRequired;
                    return null;
                  },
                ),
                const SizedBox(height: NexoraSpace.md),
                TextField(
                  controller: _reference,
                  decoration: InputDecoration(
                    labelText: l10n.ordersReference,
                    helperText: l10n.commonOptional,
                  ),
                ),
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.ordersLines(returnable.length)),
                if (returnable.isEmpty)
                  NexoraCard(
                    child: Text(
                      l10n.commonEmpty,
                      style: context.texts.bodyMedium,
                    ),
                  )
                else
                  for (final line in returnable)
                    Padding(
                      padding: const EdgeInsets.only(bottom: NexoraSpace.md),
                      child: NexoraCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              line.productName,
                              style: context.texts.titleSmall,
                            ),
                            Text(
                              '${line.productSku} · ${l10n.commonQuantity} '
                              '${formatQuantity(line.quantity)} · '
                              '${l10n.ordersQuantityReturned} '
                              '${formatQuantity(line.quantityReturned)}',
                              style: context.texts.bodySmall,
                              textDirection: TextDirection.ltr,
                            ),
                            const SizedBox(height: NexoraSpace.sm),
                            TextField(
                              controller: _quantityFor(line),
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[0-9.,]'),
                                ),
                              ],
                              decoration: InputDecoration(
                                labelText: l10n.commonQuantity,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                const SizedBox(height: NexoraSpace.lg),
                FilledButton(
                  onPressed: _busy ? null : () => _save(detail),
                  child: _busy
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.commonCreate),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
