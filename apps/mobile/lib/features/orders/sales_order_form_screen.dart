import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/drafts.dart';
import '../../data/providers.dart';

class SalesOrderFormScreen extends ConsumerStatefulWidget {
  const SalesOrderFormScreen({super.key});

  @override
  ConsumerState<SalesOrderFormScreen> createState() =>
      _SalesOrderFormScreenState();
}

class _SalesOrderFormScreenState extends ConsumerState<SalesOrderFormScreen> {
  final _guard = IdempotencyGuard();
  final _customerName = TextEditingController();
  final _customerEmail = TextEditingController();
  final _customerPhone = TextEditingController();
  final _reference = TextEditingController();
  final _notes = TextEditingController();
  final _lines = <_SalesLineEditor>[];
  ShelfChoice? _shelf;
  bool _busy = false;

  @override
  void dispose() {
    _customerName.dispose();
    _customerEmail.dispose();
    _customerPhone.dispose();
    _reference.dispose();
    _notes.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _pickCustomer() async {
    final customer = await showCustomerPicker(context);
    if (customer == null || !mounted) return;
    setState(() {
      _customerName.text = customer.name;
      _customerEmail.text = customer.email ?? '';
      _customerPhone.text = customer.phone ?? '';
    });
  }

  Future<void> _pickShelf() async {
    final choice = await showShelfPicker(
      context,
      title: context.l10n.ordersDeliverTo,
    );
    if (choice != null && mounted) setState(() => _shelf = choice);
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
        _SalesLineEditor(
          product: product,
          unitAmount: product.salePriceMinor == null
              ? ''
              : Money.input(product.salePriceMinor!),
        ),
      );
    });
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final name = _customerName.text.trim();
    final shelf = _shelf;
    if (name.isEmpty || shelf == null) {
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
      final rawPrice = line.unitAmount.text.trim();
      final unitPrice = rawPrice.isEmpty ? null : Money.parse(rawPrice);
      if (rawPrice.isNotEmpty && unitPrice == null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.commonInvalidAmount)));
        return;
      }
      draftLines.add(
        OrderLineDraft(
          productId: line.product.id,
          quantity: quantity,
          unitAmountMinor: unitPrice,
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
            .createSalesOrder(
              organizationId,
              SalesOrderDraft(
                customerName: name,
                customerEmail: _blank(_customerEmail.text),
                customerPhone: _blank(_customerPhone.text),
                warehouseId: shelf.warehouse.id,
                locationId: shelf.location.id,
                reference: _blank(_reference.text),
                notes: _blank(_notes.text),
                lines: draftLines,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(salesOrdersProvider);
      if (!mounted) return;
      context.pushReplacement('/orders/sales/${result.orderId}');
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
      appBar: AppBar(title: Text(l10n.ordersCreateSaleTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            TextField(
              controller: _customerName,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: l10n.ordersCustomer),
            ),
            const SizedBox(height: NexoraSpace.sm),
            OutlinedButton.icon(
              onPressed: _pickCustomer,
              icon: const Icon(Icons.person_search_outlined),
              label: Text(l10n.saleSelectCustomer),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextField(
              controller: _customerEmail,
              keyboardType: TextInputType.emailAddress,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: l10n.saleCustomerEmail,
                helperText: l10n.commonOptional,
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextField(
              controller: _customerPhone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: l10n.saleCustomerPhone,
                helperText: l10n.commonOptional,
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            ShelfField(
              label: l10n.ordersDeliverTo,
              choice: _shelf,
              onTap: _pickShelf,
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
                  child: _SalesLineCard(
                    editor: line,
                    unitLabel: l10n.ordersUnitPrice,
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

class _SalesLineEditor {
  _SalesLineEditor({required this.product, required String unitAmount})
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

class _SalesLineCard extends StatelessWidget {
  const _SalesLineCard({
    required this.editor,
    required this.unitLabel,
    required this.onRemove,
  });

  final _SalesLineEditor editor;
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
