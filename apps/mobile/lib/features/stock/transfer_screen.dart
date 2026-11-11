import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({super.key, this.productId});

  final String? productId;

  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  final _guard = IdempotencyGuard();
  final _quantity = TextEditingController();
  final _reason = TextEditingController();
  Product? _product;
  ShelfChoice? _source;
  ShelfChoice? _target;
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

  Future<void> _pickProduct() async {
    final product = await showProductPicker(context);
    if (product != null) setState(() => _product = product);
  }

  Future<void> _pickSource() async {
    final shelf = await showShelfPicker(
      context,
      title: context.l10n.stockSource,
    );
    if (shelf != null) setState(() => _source = shelf);
  }

  Future<void> _pickTarget() async {
    final shelf = await showShelfPicker(
      context,
      title: context.l10n.stockTarget,
    );
    if (shelf != null) setState(() => _target = shelf);
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final product = _product;
    final source = _source;
    final target = _target;
    if (product == null || source == null || target == null) {
      setState(() => _error = l10n.commonRequired);
      return;
    }
    if (source.location.id == target.location.id) {
      setState(() => _error = l10n.stockSameLocation);
      return;
    }
    final quantity = Money.parseQuantity(_quantity.text);
    if (quantity == null) {
      setState(() => _error = l10n.commonInvalidNumber);
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
            .transferStock(
              organizationId,
              StockTransferDraft(
                productId: product.id,
                sourceWarehouseId: source.warehouse.id,
                sourceLocationId: source.location.id,
                targetWarehouseId: target.warehouse.id,
                targetLocationId: target.location.id,
                quantity: quantity,
                reason: _reason.text.trim().isEmpty
                    ? null
                    : _reason.text.trim(),
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(movementsProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(productStockProvider(product.id));
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.stockTransferred)));
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
    return Scaffold(
      appBar: AppBar(title: Text(l10n.stockTransferTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          NexoraCard(
            onTap: _pickProduct,
            child: Row(
              children: [
                const Icon(Icons.inventory_2_outlined),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.commonProduct, style: context.texts.bodySmall),
                      Text(
                        _product?.name ?? l10n.commonSelect,
                        style: context.texts.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (_product != null)
                        Text(
                          _product!.sku,
                          style: context.texts.bodySmall,
                          textDirection: TextDirection.ltr,
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
            label: l10n.stockSource,
            choice: _source,
            onTap: _pickSource,
          ),
          const SizedBox(height: NexoraSpace.sm),
          Center(
            child: Icon(
              Icons.arrow_downward_rounded,
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: NexoraSpace.sm),
          ShelfField(
            label: l10n.stockTarget,
            choice: _target,
            onTap: _pickTarget,
          ),
          const SizedBox(height: NexoraSpace.lg),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(labelText: l10n.commonQuantity),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _reason,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(labelText: l10n.commonNote),
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
                : Text(l10n.stockMove),
          ),
        ],
      ),
    );
  }
}
