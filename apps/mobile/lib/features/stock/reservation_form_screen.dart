import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
import '../../data/providers.dart';

class ReservationFormScreen extends ConsumerStatefulWidget {
  const ReservationFormScreen({super.key, this.productId});

  final String? productId;

  @override
  ConsumerState<ReservationFormScreen> createState() =>
      _ReservationFormScreenState();
}

class _ReservationFormScreenState extends ConsumerState<ReservationFormScreen> {
  final _guard = IdempotencyGuard();
  final _quantity = TextEditingController();
  final _note = TextEditingController();
  Product? _product;
  ShelfChoice? _shelf;
  DateTime? _expiresAt;
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
    _note.dispose();
    super.dispose();
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

  Future<void> _pickExpiry() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _expiresAt ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date != null) setState(() => _expiresAt = date);
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final product = _product;
    final shelf = _shelf;
    if (product == null || shelf == null) {
      setState(() => _error = l10n.commonRequired);
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
            .reserveStock(
              organizationId,
              StockReservationDraft(
                productId: product.id,
                warehouseId: shelf.warehouse.id,
                locationId: shelf.location.id,
                quantity: quantity,
                expiresAt: _expiresAt == null
                    ? null
                    : DateTime(
                        _expiresAt!.year,
                        _expiresAt!.month,
                        _expiresAt!.day,
                        23,
                        59,
                        59,
                      ).toUtc().toIso8601String(),
                note: _note.text.trim().isEmpty ? null : _note.text.trim(),
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(reservationsProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(productStockProvider(product.id));
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.commonSuccess)));
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
      appBar: AppBar(title: Text(l10n.stockReserve)),
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
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          ShelfField(
            label: l10n.commonLocation,
            choice: _shelf,
            onTap: _pickShelf,
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(
              labelText: l10n.commonQuantity,
              helperText: l10n.stockReserveHint,
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          NexoraCard(
            onTap: _pickExpiry,
            child: Row(
              children: [
                const Icon(Icons.event_outlined),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.stockExpires, style: context.texts.bodySmall),
                      Text(
                        _expiresAt == null
                            ? l10n.commonOptional
                            : formatDate(_expiresAt),
                        style: context.texts.titleSmall,
                      ),
                    ],
                  ),
                ),
                if (_expiresAt != null)
                  IconButton(
                    tooltip: l10n.commonClear,
                    onPressed: () => setState(() => _expiresAt = null),
                    icon: const Icon(Icons.close_rounded),
                  )
                else
                  const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _note,
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
                : Text(l10n.stockReserve),
          ),
        ],
      ),
    );
  }
}
