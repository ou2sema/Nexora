import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/devices.dart';
import '../../data/models/drafts.dart';
import '../../data/providers.dart';

class DeviceFormScreen extends ConsumerStatefulWidget {
  const DeviceFormScreen({super.key, this.productId});

  final String? productId;

  @override
  ConsumerState<DeviceFormScreen> createState() => _DeviceFormScreenState();
}

class _DeviceFormScreenState extends ConsumerState<DeviceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _guard = IdempotencyGuard();
  final _serial = TextEditingController();
  final _imei = TextEditingController();
  final _supplierReference = TextEditingController();
  final _note = TextEditingController();
  Product? _product;
  ShelfChoice? _shelf;
  DeviceCondition _condition = DeviceCondition.newUnit;
  DateTime? _warrantyStart;
  DateTime? _warrantyEnd;
  bool _busy = false;

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
          // The picker stays available if the prefilled product cannot load.
        }
      });
    }
  }

  @override
  void dispose() {
    _serial.dispose();
    _imei.dispose();
    _supplierReference.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickProduct() async {
    final product = await showProductPicker(context, onlySerialized: true);
    if (product != null && mounted) setState(() => _product = product);
  }

  Future<void> _pickShelf() async {
    final choice = await showShelfPicker(
      context,
      title: context.l10n.devicesRegisterTitle,
    );
    if (choice != null && mounted) setState(() => _shelf = choice);
  }

  Future<void> _pickDate({required bool start}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (start ? _warrantyStart : _warrantyEnd) ?? now,
      firstDate: DateTime(now.year - 10),
      lastDate: DateTime(now.year + 20),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (start) {
        _warrantyStart = picked;
      } else {
        _warrantyEnd = picked;
      }
    });
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final product = _product;
    final shelf = _shelf;
    if (product == null || shelf == null) {
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
            .registerDevice(
              organizationId,
              DeviceDraft(
                productId: product.id,
                serialNumber: _serial.text.trim(),
                imei: _blank(_imei.text),
                condition: _condition.wire,
                warehouseId: shelf.warehouse.id,
                locationId: shelf.location.id,
                warrantyStartOn: _warrantyStart == null
                    ? null
                    : isoDate(_warrantyStart!),
                warrantyEndOn: _warrantyEnd == null
                    ? null
                    : isoDate(_warrantyEnd!),
                supplierReference: _blank(_supplierReference.text),
                note: _blank(_note.text),
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(devicesProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.devicesDeviceRegistered)));
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

  String? _blank(String value) => value.trim().isEmpty ? null : value.trim();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.devicesRegisterTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              NexoraCard(
                onTap: _pickProduct,
                child: Row(
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      color: context.colors.primary,
                    ),
                    const SizedBox(width: NexoraSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.commonProduct,
                            style: context.texts.bodySmall,
                          ),
                          Text(
                            _product?.name ?? l10n.ordersSelectProduct,
                            style: context.texts.titleSmall,
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
              TextFormField(
                controller: _serial,
                autofocus: true,
                textCapitalization: TextCapitalization.characters,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(labelText: l10n.devicesSerial),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _imei,
                keyboardType: TextInputType.number,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  labelText: l10n.devicesImei,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              DropdownButtonFormField<DeviceCondition>(
                initialValue: _condition,
                decoration: InputDecoration(labelText: l10n.devicesCondition),
                items: [
                  for (final condition in DeviceCondition.values)
                    DropdownMenuItem(
                      value: condition,
                      child: Text(deviceConditionLabel(l10n, condition)),
                    ),
                ],
                onChanged: (value) => setState(
                  () => _condition = value ?? DeviceCondition.newUnit,
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              ShelfField(
                label: l10n.commonLocation,
                choice: _shelf,
                onTap: _pickShelf,
              ),
              const SizedBox(height: NexoraSpace.md),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickDate(start: true),
                      child: Text(
                        _warrantyStart == null
                            ? l10n.devicesWarrantyStart
                            : formatDate(_warrantyStart),
                      ),
                    ),
                  ),
                  const SizedBox(width: NexoraSpace.md),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickDate(start: false),
                      child: Text(
                        _warrantyEnd == null
                            ? l10n.devicesWarrantyEnd
                            : formatDate(_warrantyEnd),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _supplierReference,
                decoration: InputDecoration(
                  labelText: l10n.devicesSupplierRef,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _note,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: l10n.commonNote,
                  helperText: l10n.commonOptional,
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
                    : Text(l10n.devicesRegister),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
