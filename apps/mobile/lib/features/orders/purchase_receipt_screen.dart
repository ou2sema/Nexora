import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/drafts.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class PurchaseReceiptScreen extends ConsumerStatefulWidget {
  const PurchaseReceiptScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<PurchaseReceiptScreen> createState() =>
      _PurchaseReceiptScreenState();
}

class _PurchaseReceiptScreenState extends ConsumerState<PurchaseReceiptScreen> {
  final _guard = IdempotencyGuard();
  final _note = TextEditingController();
  final _quantities = <String, TextEditingController>{};
  final _serials = <String, List<_SerialEditor>>{};
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    for (final controller in _quantities.values) {
      controller.dispose();
    }
    for (final list in _serials.values) {
      for (final serial in list) {
        serial.dispose();
      }
    }
    super.dispose();
  }

  TextEditingController _quantityFor(PurchaseOrderLine line) =>
      _quantities.putIfAbsent(
        line.id,
        () => TextEditingController(
          text: formatQuantity(line.quantityOutstanding),
        ),
      );

  List<_SerialEditor> _serialsFor(String lineId) =>
      _serials.putIfAbsent(lineId, () => []);

  void _addSerial(String lineId) =>
      setState(() => _serialsFor(lineId).add(_SerialEditor()));

  void _removeSerial(String lineId, _SerialEditor serial) => setState(() {
    _serialsFor(lineId).remove(serial);
    serial.dispose();
  });

  Future<void> _post(PurchaseOrderDetail detail) async {
    final l10n = context.l10n;
    final lines = <ReceiptLineDraft>[];
    for (final line in detail.lines) {
      if (line.quantityOutstanding <= 0) continue;
      if (line.isSerialized) {
        final serials = _serialsFor(line.id);
        if (serials.isEmpty) continue;
        if (serials.length > line.quantityOutstanding) continue;
        for (final serial in serials) {
          if (serial.serial.text.trim().isEmpty) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(l10n.devicesSerial)));
            return;
          }
        }
        lines.add(
          ReceiptLineDraft(
            lineId: line.id,
            quantity: serials.length.toDouble(),
            serials: [
              for (final serial in serials)
                ReceiptSerialDraft(
                  serialNumber: serial.serial.text.trim(),
                  imei: serial.imei.text.trim().isEmpty
                      ? null
                      : serial.imei.text.trim(),
                ),
            ],
          ),
        );
      } else {
        final raw = _quantityFor(line).text.trim();
        if (raw.isEmpty) continue;
        final quantity = Money.parseQuantity(raw);
        if (quantity == null || quantity > line.quantityOutstanding) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.commonInvalidNumber)));
          return;
        }
        lines.add(ReceiptLineDraft(lineId: line.id, quantity: quantity));
      }
    }
    if (lines.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.commonRequired)));
      return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .receivePurchaseOrder(
              organizationId,
              widget.orderId,
              PurchaseReceiptDraft(
                note: _note.text.trim().isEmpty ? null : _note.text.trim(),
                lines: lines,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(purchaseOrderProvider(widget.orderId));
      ref.invalidate(purchaseOrdersProvider);
      ref.invalidate(purchaseReturnsProvider(widget.orderId));
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(movementsProvider);
      ref.invalidate(devicesProvider);
      ref.invalidate(productStockProvider);
      ref.invalidate(reportOverviewProvider);
      ref.invalidate(lowStockProvider);
      ref.invalidate(supplierPerformanceProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.ordersReceiptPosted)));
      Navigator.of(context).pop();
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
    final role = ref.watch(activeRoleProvider);
    final value = ref.watch(purchaseOrderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersReceiveTitle)),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(purchaseOrderProvider(widget.orderId)),
        ),
        data: (detail) {
          final receivable = detail.lines
              .where((line) => line.quantityOutstanding > 0)
              .toList(growable: false);
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(l10n.ordersPostReceiptHint, style: context.texts.bodyMedium),
              const SizedBox(height: NexoraSpace.lg),
              if (receivable.isEmpty)
                NexoraCard(
                  child: Text(
                    l10n.commonEmpty,
                    style: context.texts.bodyMedium,
                  ),
                )
              else
                for (final line in receivable)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.md),
                    child: _ReceiptLineCard(
                      line: line,
                      quantity: _quantityFor(line),
                      serials: _serialsFor(line.id),
                      onAddSerial: () => _addSerial(line.id),
                      onRemoveSerial: (serial) =>
                          _removeSerial(line.id, serial),
                    ),
                  ),
              const SizedBox(height: NexoraSpace.md),
              TextField(
                controller: _note,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: l10n.ordersReceiveNote,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.lg),
              if (role.canWrite && receivable.isNotEmpty)
                FilledButton(
                  onPressed: _busy ? null : () => _post(detail),
                  child: _busy
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.ordersPostReceipt),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SerialEditor {
  final serial = TextEditingController();
  final imei = TextEditingController();

  void dispose() {
    serial.dispose();
    imei.dispose();
  }
}

class _ReceiptLineCard extends StatelessWidget {
  const _ReceiptLineCard({
    required this.line,
    required this.quantity,
    required this.serials,
    required this.onAddSerial,
    required this.onRemoveSerial,
  });

  final PurchaseOrderLine line;
  final TextEditingController quantity;
  final List<_SerialEditor> serials;
  final VoidCallback onAddSerial;
  final ValueChanged<_SerialEditor> onRemoveSerial;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.productName, style: context.texts.titleSmall),
                    Text(
                      '${line.productSku} · '
                      '${l10n.ordersRemaining} ${formatQuantity(line.quantityOutstanding)}',
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              if (line.isSerialized) StatusPill(label: l10n.ordersSerials),
            ],
          ),
          const SizedBox(height: NexoraSpace.sm),
          if (line.isSerialized) ...[
            for (final serial in serials)
              Padding(
                padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: serial.serial,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                          labelText: l10n.devicesSerial,
                        ),
                      ),
                    ),
                    const SizedBox(width: NexoraSpace.sm),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: serial.imei,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                          labelText: l10n.devicesImei,
                          helperText: l10n.commonOptional,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: l10n.commonRemove,
                      onPressed: () => onRemoveSerial(serial),
                      icon: const Icon(Icons.remove_circle_outline_rounded),
                    ),
                  ],
                ),
              ),
            OutlinedButton.icon(
              onPressed: serials.length.toDouble() >= line.quantityOutstanding
                  ? null
                  : onAddSerial,
              icon: const Icon(Icons.add_rounded),
              label: Text(l10n.ordersAddSerial),
            ),
            Text(
              l10n.ordersSerialCountMismatch,
              style: context.texts.bodySmall,
            ),
          ] else
            TextField(
              controller: quantity,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
              ],
              decoration: InputDecoration(labelText: l10n.commonQuantity),
            ),
        ],
      ),
    );
  }
}
