import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/drafts.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class PurchaseOrderFormScreen extends ConsumerStatefulWidget {
  const PurchaseOrderFormScreen({super.key});

  @override
  ConsumerState<PurchaseOrderFormScreen> createState() =>
      _PurchaseOrderFormScreenState();
}

class _PurchaseOrderFormScreenState
    extends ConsumerState<PurchaseOrderFormScreen> {
  final _guard = IdempotencyGuard();
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  final _lines = <_OrderLineEditor>[];
  Supplier? _supplier;
  ShelfChoice? _shelf;
  DateTime? _expectedOn;
  bool _busy = false;

  @override
  void dispose() {
    _reference.dispose();
    _notes.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _pickSupplier() async {
    final supplier = await showSupplierPicker(context);
    if (supplier != null && mounted) setState(() => _supplier = supplier);
  }

  Future<void> _pickShelf() async {
    final choice = await showShelfPicker(
      context,
      title: context.l10n.ordersDeliverTo,
    );
    if (choice != null && mounted) setState(() => _shelf = choice);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expectedOn ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
    );
    if (picked != null && mounted) setState(() => _expectedOn = picked);
  }

  Future<void> _addLine() async {
    final product = await showProductPicker(context);
    if (product == null || !mounted) return;
    if (_lines.any((line) => line.product.id == product.id)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.ordersDuplicateProduct)),
      );
      return;
    }
    setState(() {
      _lines.add(
        _OrderLineEditor(
          product: product,
          unitAmount: product.purchasePriceMinor == null
              ? ''
              : Money.input(product.purchasePriceMinor!),
        ),
      );
    });
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final supplier = _supplier;
    final shelf = _shelf;
    if (supplier == null || shelf == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.commonRequired)));
      return;
    }
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.ordersAtLeastOneLine)));
      return;
    }
    final draftLines = <OrderLineDraft>[];
    for (final line in _lines) {
      final quantity = Money.parseQuantity(line.quantity.text);
      if (quantity == null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.commonInvalidNumber)));
        return;
      }
      final rawCost = line.unitAmount.text.trim();
      final unitCost = rawCost.isEmpty ? null : Money.parse(rawCost);
      if (rawCost.isNotEmpty && unitCost == null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.commonInvalidAmount)));
        return;
      }
      draftLines.add(
        OrderLineDraft(
          productId: line.product.id,
          quantity: quantity,
          unitAmountMinor: unitCost,
        ),
      );
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      final result = await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .createPurchaseOrder(
              organizationId,
              PurchaseOrderDraft(
                supplierId: supplier.id,
                warehouseId: shelf.warehouse.id,
                locationId: shelf.location.id,
                expectedOn: _expectedOn == null ? null : isoDate(_expectedOn!),
                reference: _blank(_reference.text),
                notes: _blank(_notes.text),
                lines: draftLines,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(purchaseOrdersProvider);
      ref.invalidate(supplierPerformanceProvider);
      if (!mounted) return;
      context.pushReplacement('/orders/purchases/${result.orderId}');
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

  String? _blank(String value) => value.trim().isEmpty ? null : value.trim();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersCreatePurchaseTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            NexoraCard(
              onTap: _pickSupplier,
              child: Row(
                children: [
                  Icon(
                    Icons.local_shipping_outlined,
                    color: context.colors.primary,
                  ),
                  const SizedBox(width: NexoraSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.ordersSupplier,
                          style: context.texts.bodySmall,
                        ),
                        Text(
                          _supplier?.name ?? l10n.ordersSelectSupplier,
                          style: context.texts.titleSmall,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded),
                ],
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            ShelfField(
              label: l10n.ordersDeliverTo,
              choice: _shelf,
              onTap: _pickShelf,
            ),
            const SizedBox(height: NexoraSpace.md),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.event_outlined),
              label: Text(
                _expectedOn == null
                    ? l10n.ordersExpectedDate
                    : formatDate(_expectedOn),
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextField(
              controller: _reference,
              decoration: InputDecoration(
                labelText: l10n.ordersReference,
                helperText: l10n.commonOptional,
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: l10n.ordersNotes,
                helperText: l10n.commonOptional,
              ),
            ),
            const SizedBox(height: NexoraSpace.xl),
            SectionHeader(
              title: l10n.ordersLines(_lines.length),
              actionLabel: l10n.ordersAddLine,
              onAction: _addLine,
            ),
            if (_lines.isEmpty)
              NexoraCard(
                child: Text(
                  l10n.ordersAtLeastOneLine,
                  style: context.texts.bodyMedium,
                ),
              )
            else
              for (final line in _lines)
                Padding(
                  padding: const EdgeInsets.only(bottom: NexoraSpace.md),
                  child: _OrderLineCard(
                    editor: line,
                    unitLabel: l10n.ordersUnitCost,
                    onRemove: () => setState(() {
                      line.dispose();
                      _lines.remove(line);
                    }),
                  ),
                ),
            const SizedBox(height: NexoraSpace.lg),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.commonCreate),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderLineEditor {
  _OrderLineEditor({required this.product, required String unitAmount})
    : quantity = TextEditingController(text: '1'),
      unitAmount = TextEditingController(text: unitAmount);

  final Product product;
  final TextEditingController quantity;
  final TextEditingController unitAmount;

  void dispose() {
    quantity.dispose();
    unitAmount.dispose();
  }
}

class _OrderLineCard extends StatelessWidget {
  const _OrderLineCard({
    required this.editor,
    required this.unitLabel,
    required this.onRemove,
  });

  final _OrderLineEditor editor;
  final String unitLabel;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) => NexoraCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(editor.product.name, style: context.texts.titleSmall),
                  Text(
                    editor.product.sku,
                    style: context.texts.bodySmall,
                    textDirection: TextDirection.ltr,
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: context.l10n.commonRemove,
              onPressed: onRemove,
              icon: const Icon(Icons.remove_circle_outline_rounded),
            ),
          ],
        ),
        const SizedBox(height: NexoraSpace.sm),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: editor.quantity,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                decoration: InputDecoration(
                  labelText: context.l10n.commonQuantity,
                ),
              ),
            ),
            const SizedBox(width: NexoraSpace.md),
            Expanded(
              child: TextField(
                controller: editor.unitAmount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                decoration: InputDecoration(
                  labelText: unitLabel,
                  helperText: context.l10n.commonOptional,
                ),
              ),
            ),
          ],
        ),
      ],
    ),
  );
}
