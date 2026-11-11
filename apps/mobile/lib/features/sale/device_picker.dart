import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/nexora_theme.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/devices.dart';
import '../../data/providers.dart';
import 'sale_controller.dart';

/// A serialized product sells one unit at a time, so the cashier picks the exact
/// serial that leaves the shelf. Units on another shelf are hidden here: the
/// invoice is written against the shelf the basket already names.
Future<Device?> showDevicePicker(
  BuildContext context,
  WidgetRef ref,
  Product product,
) {
  final draft = ref.read(saleDraftProvider);
  return showModalBottomSheet<Device>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _DevicePickerSheet(
      product: product,
      warehouseId: draft.warehouseId,
      locationId: draft.locationId,
    ),
  );
}

class _DevicePickerSheet extends ConsumerStatefulWidget {
  const _DevicePickerSheet({
    required this.product,
    this.warehouseId,
    this.locationId,
  });

  final Product product;
  final String? warehouseId;
  final String? locationId;

  @override
  ConsumerState<_DevicePickerSheet> createState() => _DevicePickerSheetState();
}

class _DevicePickerSheetState extends ConsumerState<_DevicePickerSheet> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

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

  List<Device> _onShelf(List<Device> devices) {
    final warehouseId = widget.warehouseId;
    final locationId = widget.locationId;
    if (warehouseId == null || locationId == null) return devices;
    return devices
        .where(
          (device) =>
              device.warehouseId == warehouseId &&
              device.locationId == locationId,
        )
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final devices = ref.watch(
      devicesProvider((
        search: _query,
        status: DeviceStatus.inStock.wire,
        productId: widget.product.id,
        page: 1,
      )),
    );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.saleChooseDevice, style: context.texts.titleLarge),
                  const SizedBox(height: NexoraSpace.xs),
                  Text(
                    '${widget.product.name} · ${widget.product.sku}',
                    style: context.texts.bodySmall,
                    textDirection: TextDirection.ltr,
                  ),
                  if (widget.warehouseId != null) ...[
                    const SizedBox(height: NexoraSpace.xs),
                    Text(
                      l10n.scanStockLines,
                      style: context.texts.bodySmall?.copyWith(
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const SizedBox(height: NexoraSpace.md),
                  SearchField(
                    hint: l10n.commonSerial,
                    controller: _search,
                    onChanged: _onSearch,
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: AsyncPane(
                value: devices,
                onRetry: () => ref.invalidate(devicesProvider),
                builder: (page) {
                  final items = _onShelf(page.items);
                  if (items.isEmpty) {
                    return EmptyState(
                      icon: Icons.smartphone_outlined,
                      title: l10n.saleNoSellableDevices,
                      message: l10n.saleSellingShelf,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: NexoraSpace.sm),
                    itemBuilder: (context, index) {
                      final device = items[index];
                      return NexoraCard(
                        onTap: () => Navigator.of(context).pop(device),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: context.colors.primaryContainer,
                              foregroundColor: context.colors.primary,
                              child: const Icon(Icons.smartphone_rounded),
                            ),
                            const SizedBox(width: NexoraSpace.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    device.serialNumber,
                                    style: context.texts.titleSmall,
                                    textDirection: TextDirection.ltr,
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${device.warehouseCode} · ${device.locationCode} · '
                                    '${deviceConditionLabel(l10n, device.condition)}',
                                    style: context.texts.bodySmall,
                                  ),
                                  if (device.imei != null)
                                    Text(
                                      device.imei!,
                                      style: context.texts.bodySmall,
                                      textDirection: TextDirection.ltr,
                                    ),
                                ],
                              ),
                            ),
                            StatusPill(
                              label: deviceStatusLabel(l10n, device.status),
                              tone: deviceStatusTone(device.status),
                            ),
                            const SizedBox(width: NexoraSpace.xs),
                            const Icon(Icons.chevron_right_rounded),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
