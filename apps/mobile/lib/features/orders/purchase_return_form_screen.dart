import 'dart:async';

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
import '../../data/models/devices.dart';
import '../../data/models/drafts.dart';
import '../../data/models/operations.dart';
import '../../data/providers.dart';

class PurchaseReturnFormScreen extends ConsumerStatefulWidget {
  const PurchaseReturnFormScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<PurchaseReturnFormScreen> createState() =>
      _PurchaseReturnFormScreenState();
}

class _PurchaseReturnFormScreenState
    extends ConsumerState<PurchaseReturnFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _guard = IdempotencyGuard();
  final _reason = TextEditingController();
  final _reference = TextEditingController();
  final _quantities = <String, TextEditingController>{};
  final _devices = <String, List<Device>>{};
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

  TextEditingController _quantityFor(PurchaseOrderLine line) =>
      _quantities.putIfAbsent(
        line.id,
        () => TextEditingController(
          text: formatQuantity(line.quantityReceived - line.quantityReturned),
        ),
      );

  Future<void> _pickDevices(PurchaseOrderLine line) async {
    final picked = await showModalBottomSheet<List<Device>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ReturnDeviceSheet(productId: line.productId),
    );
    if (picked == null || !mounted) return;
    setState(() => _devices[line.id] = picked);
  }

  Future<void> _save(PurchaseOrderDetail detail) async {
    final l10n = context.l10n;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final lines = <PurchaseReturnLineDraft>[];
    for (final line in detail.lines) {
      final available = line.quantityReceived - line.quantityReturned;
      if (available <= 0) continue;
      if (line.isSerialized) {
        final selected = _devices[line.id] ?? const <Device>[];
        if (selected.isEmpty) continue;
        if (selected.length > available) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.commonInvalidNumber)));
          return;
        }
        lines.add(
          PurchaseReturnLineDraft(
            purchaseOrderLineId: line.id,
            quantity: selected.length.toDouble(),
            deviceIds: selected
                .map((device) => device.id)
                .toList(growable: false),
          ),
        );
      } else {
        final raw = _quantityFor(line).text.trim();
        if (raw.isEmpty) continue;
        final quantity = Money.parseQuantity(raw);
        if (quantity == null || quantity > available) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.commonInvalidNumber)));
          return;
        }
        lines.add(
          PurchaseReturnLineDraft(
            purchaseOrderLineId: line.id,
            quantity: quantity,
          ),
        );
      }
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
            .createPurchaseReturn(
              organizationId,
              widget.orderId,
              PurchaseReturnDraft(
                reason: _reason.text.trim(),
                reference: _reference.text.trim().isEmpty
                    ? null
                    : _reference.text.trim(),
                lines: lines,
              ),
              idempotencyKey: key,
            ),
      );
      ref.invalidate(purchaseReturnsProvider(widget.orderId));
      ref.invalidate(purchaseOrderProvider(widget.orderId));
      ref.invalidate(purchaseOrdersProvider);
      if (!mounted) return;
      context.pushReplacement(
        '/orders/purchases/${widget.orderId}/returns/${result.returnId}',
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
    final value = ref.watch(purchaseOrderProvider(widget.orderId));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.ordersNewReturn)),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(purchaseOrderProvider(widget.orderId)),
        ),
        data: (detail) {
          final returnable = detail.lines
              .where(
                (line) => line.quantityReceived - line.quantityReturned > 0,
              )
              .toList(growable: false);
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Text(
                  '${detail.order.number} · ${detail.order.supplierName}',
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
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        line.productName,
                                        style: context.texts.titleSmall,
                                      ),
                                      Text(
                                        '${line.productSku} · '
                                        '${l10n.ordersQuantityReceived} '
                                        '${formatQuantity(line.quantityReceived)} · '
                                        '${l10n.ordersQuantityReturned} '
                                        '${formatQuantity(line.quantityReturned)}',
                                        style: context.texts.bodySmall,
                                        textDirection: TextDirection.ltr,
                                      ),
                                    ],
                                  ),
                                ),
                                if (line.isSerialized)
                                  StatusPill(label: l10n.ordersSerials),
                              ],
                            ),
                            const SizedBox(height: NexoraSpace.sm),
                            if (line.isSerialized) ...[
                              for (final device
                                  in _devices[line.id] ?? const <Device>[])
                                Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: NexoraSpace.xs,
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          device.imei == null
                                              ? device.serialNumber
                                              : '${device.serialNumber} · ${device.imei}',
                                          style: context.texts.bodyMedium,
                                          textDirection: TextDirection.ltr,
                                        ),
                                      ),
                                      IconButton(
                                        tooltip: l10n.commonRemove,
                                        onPressed: () => setState(() {
                                          _devices[line.id]!.remove(device);
                                        }),
                                        icon: const Icon(
                                          Icons.remove_circle_outline_rounded,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              OutlinedButton.icon(
                                onPressed: () => _pickDevices(line),
                                icon: const Icon(Icons.qr_code_2_rounded),
                                label: Text(l10n.ordersSerials),
                              ),
                            ] else
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

class _ReturnDeviceSheet extends ConsumerStatefulWidget {
  const _ReturnDeviceSheet({required this.productId});

  final String productId;

  @override
  ConsumerState<_ReturnDeviceSheet> createState() => _ReturnDeviceSheetState();
}

class _ReturnDeviceSheetState extends ConsumerState<_ReturnDeviceSheet> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';
  final _chosen = <String, Device>{};

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final devices = ref.watch(
      devicesProvider((
        search: _query,
        status: DeviceStatus.inStock.wire,
        productId: widget.productId,
        page: 1,
      )),
    );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(l10n.ordersSerials, style: context.texts.titleLarge),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SearchField(
                hint: l10n.devicesSearchHint,
                controller: _search,
                onChanged: _onSearch,
              ),
            ),
            const SizedBox(height: NexoraSpace.sm),
            const Divider(height: 1),
            Expanded(
              child: AsyncPane(
                value: devices,
                onRetry: () => ref.invalidate(devicesProvider),
                builder: (page) => page.items.isEmpty
                    ? EmptyState(
                        icon: Icons.devices_other_outlined,
                        title: l10n.commonEmpty,
                        message: l10n.devicesNoDevices,
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                        itemCount: page.items.length,
                        itemBuilder: (context, index) {
                          final device = page.items[index];
                          final selected = _chosen.containsKey(device.id);
                          return CheckboxListTile(
                            value: selected,
                            title: Text(
                              device.serialNumber,
                              textDirection: TextDirection.ltr,
                            ),
                            subtitle: Text(
                              '${device.warehouseCode}/${device.locationCode}'
                              '${device.imei == null ? '' : ' · ${device.imei}'}',
                              textDirection: TextDirection.ltr,
                            ),
                            onChanged: (checked) => setState(() {
                              if (checked == true) {
                                _chosen[device.id] = device;
                              } else {
                                _chosen.remove(device.id);
                              }
                            }),
                          );
                        },
                      ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: FilledButton(
                  onPressed: _chosen.isEmpty
                      ? null
                      : () =>
                            Navigator.of(context).pop(_chosen.values.toList()),
                  child: Text('${l10n.commonSelect} (${_chosen.length})'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
