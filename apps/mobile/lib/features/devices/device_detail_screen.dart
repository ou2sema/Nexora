import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/devices.dart';
import '../../data/providers.dart';

class DeviceDetailScreen extends ConsumerStatefulWidget {
  const DeviceDetailScreen({super.key, required this.deviceId});

  final String deviceId;

  @override
  ConsumerState<DeviceDetailScreen> createState() => _DeviceDetailScreenState();
}

class _DeviceDetailScreenState extends ConsumerState<DeviceDetailScreen> {
  final _guard = IdempotencyGuard();
  bool _busy = false;

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _invalidateAll() {
    ref.invalidate(deviceProvider(widget.deviceId));
    ref.invalidate(deviceEventsProvider(widget.deviceId));
    ref.invalidate(devicesProvider);
    ref.invalidate(productStockProvider);
    ref.invalidate(stockLevelsProvider);
    ref.invalidate(stockSummaryProvider);
    ref.invalidate(movementsProvider);
    ref.invalidate(reportOverviewProvider);
    ref.invalidate(lowStockProvider);
  }

  Future<void> _move() async {
    final l10n = context.l10n;
    final choice = await showShelfPicker(context, title: l10n.devicesMoveTitle);
    if (choice == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .moveDevice(
              organizationId,
              widget.deviceId,
              warehouseId: choice.warehouse.id,
              locationId: choice.location.id,
              idempotencyKey: key,
            ),
      );
      _invalidateAll();
      if (mounted) _show(l10n.commonSuccess);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeStatus(Device device) async {
    final l10n = context.l10n;
    final entry = await showDialog<({DeviceStatus status, String? note})>(
      context: context,
      builder: (_) => _StatusDialog(current: device.status),
    );
    if (entry == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .changeDeviceStatus(
              organizationId,
              widget.deviceId,
              status: entry.status,
              note: entry.note,
              idempotencyKey: key,
            ),
      );
      _invalidateAll();
      if (mounted) _show(l10n.devicesStatusChanged);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final device = ref.watch(deviceProvider(widget.deviceId));
    final events = ref.watch(deviceEventsProvider(widget.deviceId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.commonDevice),
        actions: [
          IconButton(
            tooltip: l10n.commonRefresh,
            onPressed: () {
              ref.invalidate(deviceProvider(widget.deviceId));
              ref.invalidate(deviceEventsProvider(widget.deviceId));
            },
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: device.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(deviceProvider(widget.deviceId)),
        ),
        data: (value) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(deviceProvider(widget.deviceId));
            ref.invalidate(deviceEventsProvider(widget.deviceId));
            await ref.read(deviceProvider(widget.deviceId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              NexoraCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            value.productName,
                            style: context.texts.titleMedium,
                          ),
                        ),
                        StatusPill(
                          label: deviceStatusLabel(l10n, value.status),
                          tone: deviceStatusTone(value.status),
                        ),
                      ],
                    ),
                    Text(
                      value.productSku,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                    const Divider(height: NexoraSpace.xl),
                    KeyValueRow(
                      label: l10n.devicesSerial,
                      value: value.serialNumber,
                    ),
                    if (value.imei != null)
                      KeyValueRow(label: l10n.devicesImei, value: value.imei!),
                    KeyValueRow(
                      label: l10n.devicesCondition,
                      value: deviceConditionLabel(l10n, value.condition),
                    ),
                    KeyValueRow(
                      label: l10n.commonLocation,
                      value: '${value.warehouseCode}/${value.locationCode}',
                    ),
                    if (value.warrantyStartOn != null)
                      KeyValueRow(
                        label: l10n.devicesWarrantyStart,
                        value: value.warrantyStartOn!,
                      ),
                    if (value.warrantyEndOn != null)
                      KeyValueRow(
                        label: l10n.devicesWarrantyEnd,
                        value: value.warrantyEndOn!,
                      ),
                    if (value.supplierReference != null)
                      KeyValueRow(
                        label: l10n.devicesSupplierRef,
                        value: value.supplierReference!,
                      ),
                    if (value.note != null)
                      KeyValueRow(label: l10n.commonNote, value: value.note!),
                    KeyValueRow(
                      label: l10n.ordersReceived,
                      value: formatDateTime(value.receivedAt),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          context.push('/products/${value.productId}'),
                      icon: const Icon(Icons.inventory_2_outlined),
                      label: Text(l10n.commonProduct),
                    ),
                  ),
                  const SizedBox(width: NexoraSpace.sm),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: role.canWrite && !_busy ? _move : null,
                      icon: const Icon(Icons.move_down_rounded),
                      label: Text(l10n.devicesMove),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NexoraSpace.sm),
              OutlinedButton.icon(
                onPressed: role.canWrite && !_busy
                    ? () => _changeStatus(value)
                    : null,
                icon: const Icon(Icons.swap_horiz_rounded),
                label: Text(l10n.devicesChangeStatus),
              ),
              const SizedBox(height: NexoraSpace.xl),
              SectionHeader(title: l10n.devicesEventHistory),
              events.when(
                data: (items) => items.isEmpty
                    ? NexoraCard(
                        child: Text(
                          l10n.devicesNoEvents,
                          style: context.texts.bodyMedium,
                        ),
                      )
                    : Column(
                        children: [
                          for (final event in items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _EventRow(event: event),
                            ),
                        ],
                      ),
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(NexoraSpace.lg),
                    child: CircularProgressIndicator(),
                  ),
                ),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  compact: true,
                  onRetry: () =>
                      ref.invalidate(deviceEventsProvider(widget.deviceId)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event});

  final DeviceEvent event;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final transition = event.statusFrom == null || event.statusTo == null
        ? null
        : '${deviceStatusLabel(l10n, event.statusFrom!)} → '
              '${deviceStatusLabel(l10n, event.statusTo!)}';
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.eventType, style: context.texts.titleSmall),
                if (transition != null)
                  Text(transition, style: context.texts.bodySmall),
                if (event.note != null)
                  Text(event.note!, style: context.texts.bodySmall),
              ],
            ),
          ),
          Text(formatDateTime(event.createdAt), style: context.texts.bodySmall),
        ],
      ),
    );
  }
}

class _StatusDialog extends StatefulWidget {
  const _StatusDialog({required this.current});

  final DeviceStatus current;

  @override
  State<_StatusDialog> createState() => _StatusDialogState();
}

class _StatusDialogState extends State<_StatusDialog> {
  late DeviceStatus _status = widget.current;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.devicesChangeStatus),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DropdownButtonFormField<DeviceStatus>(
            initialValue: _status,
            isExpanded: true,
            decoration: InputDecoration(labelText: l10n.devicesStatus),
            items: [
              for (final status in DeviceStatus.values)
                DropdownMenuItem(
                  value: status,
                  child: Text(deviceStatusLabel(l10n, status)),
                ),
            ],
            onChanged: (value) =>
                setState(() => _status = value ?? widget.current),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _note,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: l10n.commonNote,
              helperText: l10n.commonOptional,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop((
            status: _status,
            note: _note.text.trim().isEmpty ? null : _note.text.trim(),
          )),
          child: Text(l10n.commonSave),
        ),
      ],
    );
  }
}
