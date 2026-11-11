import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/drafts.dart';
import '../../data/models/stock.dart';
import '../../data/providers.dart';

class MovementFormScreen extends ConsumerStatefulWidget {
  const MovementFormScreen({super.key, this.initialType, this.productId});

  final String? initialType;
  final String? productId;

  @override
  ConsumerState<MovementFormScreen> createState() => _MovementFormScreenState();
}

class _MovementFormScreenState extends ConsumerState<MovementFormScreen> {
  final _guard = IdempotencyGuard();
  final _quantity = TextEditingController();
  final _reason = TextEditingController();
  late StockMovementType _type = switch (widget.initialType) {
    'receipt' => StockMovementType.receipt,
    'issue' => StockMovementType.issue,
    _ => StockMovementType.adjustment,
  };
  Product? _product;
  ShelfChoice? _shelf;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final productId = widget.productId;
    if (productId != null) {
      Future.microtask(() async {
        try {
          final product = await ref.read(productProvider(productId).future);
          if (mounted) setState(() => _product = product);
        } catch (_) {
          // The picker still lets the user choose a product by hand.
        }
      });
    }
  }

  @override
  void dispose() {
    _quantity.dispose();
    _reason.dispose();
    super.dispose();
  }

  double? _parseQuantity(String raw) {
    final normalized = raw.trim().replaceAll(' ', '').replaceAll(',', '.');
    final signed = _type == StockMovementType.adjustment;
    final pattern = signed
        ? RegExp(r'^-?\d+(\.\d{1,4})?$')
        : RegExp(r'^\d+(\.\d{1,4})?$');
    if (!pattern.hasMatch(normalized)) return null;
    final value = double.tryParse(normalized);
    if (value == null || !value.isFinite) return null;
    if (signed ? value == 0 : value <= 0) return null;
    return value;
  }

  Future<void> _pickProduct() async {
    final product = await showProductPicker(context);
    if (product != null) setState(() => _product = product);
  }

  Future<void> _pickShelf() async {
    final shelf = await showShelfPicker(
      context,
      title: context.l10n.commonLocation,
    );
    if (shelf != null) setState(() => _shelf = shelf);
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final product = _product;
    final shelf = _shelf;
    if (product == null) {
      setState(() => _error = l10n.commonRequired);
      return;
    }
    if (shelf == null) {
      setState(() => _error = l10n.saleNeedShelf);
      return;
    }
    final quantity = _parseQuantity(_quantity.text);
    if (quantity == null) {
      setState(() => _error = l10n.commonInvalidNumber);
      return;
    }
    final reason = _reason.text.trim();
    if (_type == StockMovementType.adjustment && reason.length < 3) {
      setState(() => _error = l10n.stockReasonRequired);
      return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .postMovement(
              organizationId,
              StockPostingDraft(
                productId: product.id,
                warehouseId: shelf.warehouse.id,
                locationId: shelf.location.id,
                type: _type.name,
                quantity: quantity,
                reason: reason.isEmpty ? null : reason,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(movementsProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(productStockProvider(product.id));
      ref.invalidate(productsProvider);
      ref.invalidate(reportOverviewProvider);
      ref.invalidate(lowStockProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.stockPosted)));
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final adjustment = _type == StockMovementType.adjustment;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.stockPostMovement)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          _ProductCard(product: _product, onTap: _pickProduct),
          const SizedBox(height: NexoraSpace.md),
          ShelfField(
            label: l10n.commonLocation,
            choice: _shelf,
            onTap: _pickShelf,
          ),
          const SizedBox(height: NexoraSpace.lg),
          SegmentedButton<StockMovementType>(
            segments: [
              ButtonSegment(
                value: StockMovementType.receipt,
                icon: const Icon(Icons.call_received_rounded),
                label: Text(l10n.stockReceipt),
              ),
              ButtonSegment(
                value: StockMovementType.issue,
                icon: const Icon(Icons.call_made_rounded),
                label: Text(l10n.stockIssue),
              ),
              ButtonSegment(
                value: StockMovementType.adjustment,
                icon: const Icon(Icons.tune_rounded),
                label: Text(l10n.stockAdjustment),
              ),
            ],
            selected: {_type},
            onSelectionChanged: (selection) =>
                setState(() => _type = selection.single),
          ),
          const SizedBox(height: NexoraSpace.lg),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(
              decimal: true,
              signed: true,
            ),
            inputFormatters: [
              FilteringTextInputFormatter.allow(
                RegExp(adjustment ? r'[0-9.,-]' : r'[0-9.,]'),
              ),
            ],
            decoration: InputDecoration(
              labelText: adjustment
                  ? l10n.stockSignedQuantity
                  : l10n.commonQuantity,
              helperText: adjustment ? l10n.stockSignedQuantity : null,
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _reason,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: adjustment ? l10n.commonReason : l10n.commonNote,
              helperText: adjustment ? l10n.stockReasonRequired : null,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: NexoraSpace.md),
            Text(_error!, style: TextStyle(color: context.colors.error)),
          ],
          const SizedBox(height: NexoraSpace.xl),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.stockPostMovement),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final Product? product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => NexoraCard(
    onTap: onTap,
    child: Row(
      children: [
        const Icon(Icons.inventory_2_outlined),
        const SizedBox(width: NexoraSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(context.l10n.commonProduct, style: context.texts.bodySmall),
              Text(
                product?.name ?? context.l10n.commonSelect,
                style: context.texts.titleSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (product != null)
                Text(
                  product!.sku,
                  style: context.texts.bodySmall,
                  textDirection: TextDirection.ltr,
                ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}
