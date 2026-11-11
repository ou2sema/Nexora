import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/providers.dart';

class ProductEditorScreen extends ConsumerStatefulWidget {
  const ProductEditorScreen({super.key, this.initial});

  final Product? initial;

  @override
  ConsumerState<ProductEditorScreen> createState() =>
      _ProductEditorScreenState();
}

class _ProductEditorScreenState extends ConsumerState<ProductEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.initial?.name ?? '');
  late final _sku = TextEditingController(text: widget.initial?.sku ?? '');
  late final _description = TextEditingController(
    text: widget.initial?.description ?? '',
  );
  late final _unit = TextEditingController(
    text: widget.initial?.unitOfMeasure ?? 'unit',
  );
  late final _purchase = TextEditingController(
    text: widget.initial?.purchasePriceMinor == null
        ? ''
        : Money.input(widget.initial!.purchasePriceMinor!),
  );
  late final _sale = TextEditingController(
    text: widget.initial?.salePriceMinor == null
        ? ''
        : Money.input(widget.initial!.salePriceMinor!),
  );
  late final _reorder = TextEditingController(
    text: widget.initial == null
        ? '0'
        : formatQuantity(widget.initial!.reorderThreshold),
  );
  late final _barcode = TextEditingController(
    text: widget.initial?.barcode ?? '',
  );
  late final _internalCode = TextEditingController(
    text: widget.initial?.internalCode ?? '',
  );
  late String? _categoryId = widget.initial?.categoryId;
  late String? _brandId = widget.initial?.brandId;
  late bool _serialized = widget.initial?.isSerialized ?? false;
  late bool _individuallyTracked =
      widget.initial?.isIndividuallyTracked ?? false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _description.dispose();
    _unit.dispose();
    _purchase.dispose();
    _sale.dispose();
    _reorder.dispose();
    _barcode.dispose();
    _internalCode.dispose();
    super.dispose();
  }

  String? _optional(String value) => value.trim().isEmpty ? null : value.trim();

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    FocusScope.of(context).unfocus();

    final purchase = _purchase.text.trim().isEmpty
        ? null
        : Money.parse(_purchase.text);
    final sale = _sale.text.trim().isEmpty ? null : Money.parse(_sale.text);
    if ((_purchase.text.trim().isNotEmpty && purchase == null) ||
        (_sale.text.trim().isNotEmpty && sale == null)) {
      _show(context.l10n.commonInvalidAmount);
      return;
    }
    final reorder = double.tryParse(_reorder.text.replaceAll(',', '.')) ?? 0;

    final body = <String, dynamic>{
      'sku': _sku.text.trim(),
      'name': _name.text.trim(),
      'description': _optional(_description.text),
      'categoryId': _categoryId,
      'brandId': _brandId,
      'unitOfMeasure': _unit.text.trim().isEmpty ? 'unit' : _unit.text.trim(),
      'purchasePriceMinor': purchase,
      'salePriceMinor': sale,
      'reorderThreshold': reorder,
      'isSerialized': _serialized,
      'isIndividuallyTracked': _individuallyTracked,
      'barcode': _optional(_barcode.text),
      'internalCode': _optional(_internalCode.text),
    };

    setState(() => _busy = true);
    try {
      final api = ref.read(nexoraApiProvider);
      if (widget.initial == null) {
        await api.createProduct(organizationId, body);
      } else {
        await api.updateProduct(organizationId, widget.initial!.id, body);
        ref.invalidate(productProvider(widget.initial!.id));
      }
      ref.invalidate(productsProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) _show(failureText(context.l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final categories =
        ref.watch(categoriesProvider).value ?? const <Category>[];
    final brands = ref.watch(brandsProvider).value ?? const <Brand>[];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.initial == null ? l10n.commonNew : l10n.commonEdit),
        actions: [
          TextButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.commonSave),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            TextFormField(
              controller: _name,
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: l10n.commonName),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _sku,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(labelText: l10n.commonSku),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _description,
              minLines: 2,
              maxLines: 4,
              decoration: InputDecoration(labelText: l10n.inventoryDescription),
            ),
            const SizedBox(height: NexoraSpace.md),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _categoryId,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l10n.commonCategory),
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(l10n.commonNone),
                      ),
                      for (final category in categories)
                        DropdownMenuItem(
                          value: category.id,
                          child: Text(
                            category.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) => setState(() => _categoryId = value),
                  ),
                ),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _brandId,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: l10n.commonBrand),
                    items: [
                      DropdownMenuItem(
                        value: null,
                        child: Text(l10n.commonNone),
                      ),
                      for (final brand in brands)
                        DropdownMenuItem(
                          value: brand.id,
                          child: Text(
                            brand.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (value) => setState(() => _brandId = value),
                  ),
                ),
              ],
            ),
            const SizedBox(height: NexoraSpace.md),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _purchase,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                    ],
                    decoration: InputDecoration(
                      labelText: l10n.inventoryCostMinor,
                      suffixText: Money.code,
                    ),
                  ),
                ),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: TextFormField(
                    controller: _sale,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                    ],
                    decoration: InputDecoration(
                      labelText: l10n.inventoryPriceMinor,
                      suffixText: Money.code,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: NexoraSpace.md),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _unit,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(labelText: l10n.commonUnits),
                  ),
                ),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: TextFormField(
                    controller: _reorder,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                    ],
                    decoration: InputDecoration(
                      labelText: l10n.inventoryReorderLevel,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: NexoraSpace.md),
            SwitchListTile(
              value: _serialized,
              onChanged: widget.initial == null && !_individuallyTracked
                  ? (value) => setState(() => _serialized = value)
                  : null,
              title: Text(l10n.inventorySerialized),
              subtitle: Text(
                l10n.inventoryDeviceTraceability,
                style: context.texts.bodySmall,
              ),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: NexoraSpace.sm),
            SwitchListTile(
              value: _individuallyTracked,
              onChanged: widget.initial == null && !_serialized
                  ? (value) => setState(() => _individuallyTracked = value)
                  : null,
              title: Text(l10n.inventoryIndividuallyTracked),
              subtitle: Text(
                l10n.inventoryIndividuallyTrackedHint,
                style: context.texts.bodySmall,
              ),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _barcode,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.inventoryBarcode),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _internalCode,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: l10n.inventoryInternalCode,
              ),
            ),
            const SizedBox(height: NexoraSpace.xl),
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.commonSave),
            ),
          ],
        ),
      ),
    );
  }
}
