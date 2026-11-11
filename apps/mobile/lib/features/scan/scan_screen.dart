import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/devices.dart';
import '../../data/models/scanning.dart';
import '../sale/device_picker.dart';
import '../sale/sale_controller.dart';

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  final _manual = TextEditingController();
  final _focus = FocusNode();
  final _controller = MobileScannerController(
    autoStart: false,
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  ScanResult? _result;
  String? _message;
  bool _busy = false;
  bool _cameraOn = false;
  bool _permissionDenied = false;
  String? _lastCode;
  DateTime? _lastAt;

  @override
  void dispose() {
    _manual.dispose();
    _focus.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _startCamera() async {
    // The camera opens only after this tap, never on app start. Mobile Scanner
    // asks for the camera permission itself when the controller starts.
    setState(() {
      _permissionDenied = false;
      _cameraOn = true;
      _message = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await _controller.start();
      } on MobileScannerException catch (error) {
        if (!mounted) return;
        setState(() {
          _cameraOn = false;
          _permissionDenied =
              error.errorCode == MobileScannerErrorCode.permissionDenied;
          _message = context.l10n.scanPermissionDenied;
        });
      }
    });
  }

  void _onDetect(BarcodeCapture capture) {
    final raw = capture.barcodes
        .map((barcode) => barcode.rawValue)
        .whereType<String>()
        .map((value) => value.trim())
        .firstWhere((value) => value.isNotEmpty, orElse: () => '');
    if (raw.isEmpty) return;
    _resolve(raw);
  }

  Future<void> _resolve(String raw) async {
    final code = raw.trim();
    if (code.isEmpty || _busy) return;
    final now = DateTime.now();
    if (code == _lastCode &&
        _lastAt != null &&
        now.difference(_lastAt!) < const Duration(seconds: 3)) {
      return;
    }
    _lastCode = code;
    _lastAt = now;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final result = await ref
          .read(nexoraApiProvider)
          .scan(organizationId, code: code);
      if (!mounted) return;
      setState(() => _result = result);
      _manual.clear();
      _focus.unfocus();
    } catch (error) {
      if (!mounted) return;
      final failure = failureOf(error);
      setState(() {
        _result = null;
        _message = failure.kind.name == 'notFound' || failure.statusCode == 404
            ? context.l10n.scanNotFound
            : failureText(context.l10n, failure);
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addProduct(ScanProductResult result) async {
    final l10n = context.l10n;
    if (result.product.isSerialized) {
      final device = await showDevicePicker(context, ref, result.product);
      if (device != null) await _addDevice(device);
      return;
    }
    final line = result.stockLines
        .where((line) => line.available > 0)
        .firstOrNull;
    if (line == null) {
      _snack(l10n.scanDeviceNotInStock(result.product.sku));
      return;
    }
    final controller = ref.read(saleDraftProvider.notifier);
    if (!ref.read(saleDraftProvider).hasShelf) {
      controller.setShelf(
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseCode,
        locationId: line.locationId,
        locationName: line.locationCode,
      );
    }
    final added = controller.addProduct(result.product);
    if (!added) {
      _snack(l10n.scanAlreadyInBasket(result.product.name));
      return;
    }
    if (mounted) context.go('/sell');
  }

  Future<void> _addDevice(Device device) async {
    final l10n = context.l10n;
    final outcome = await ref
        .read(saleDraftProvider.notifier)
        .addDevice(device);
    if (!mounted) return;
    switch (outcome) {
      case DeviceAddResult.added:
        context.go('/sell');
      case DeviceAddResult.duplicate:
        _snack(l10n.scanAlreadyInBasket(device.serialNumber));
      case DeviceAddResult.wrongLocation:
        _snack(l10n.scanWrongLocation);
      case DeviceAddResult.notSellable:
        _snack(l10n.scanDeviceNotInStock(device.serialNumber));
    }
  }

  Future<void> _printLabel(TrackedItemSummary item) async {
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    await downloadDocument(
      context,
      () => ref.read(nexoraApiProvider).labelSheet(organizationId, [
        LabelItem.item(item.id),
      ]),
    );
  }

  void _snack(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final canWrite = ref.watch(activeRoleProvider).canWrite;
    final result = _result;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.scanTitle),
        actions: [
          if (_cameraOn)
            ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller,
              builder: (context, state, _) => IconButton(
                tooltip: l10n.scanTorch,
                onPressed: () => _controller.toggleTorch(),
                icon: Icon(
                  state.torchState == TorchState.on
                      ? Icons.flash_on_rounded
                      : Icons.flash_off_rounded,
                ),
              ),
            ),
          if (_cameraOn)
            IconButton(
              tooltip: l10n.scanStopCamera,
              onPressed: () async {
                setState(() => _cameraOn = false);
                await _controller.stop();
              },
              icon: const Icon(Icons.videocam_off_outlined),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          if (result == null) ...[
            LayoutBuilder(
              builder: (context, constraints) {
                // A full-width 4:3 preview is taller than a landscape window,
                // which would push the manual entry below the fold.
                final maxWidth =
                    MediaQuery.sizeOf(context).height * 0.45 * 4 / 3;
                return Center(
                  child: SizedBox(
                    width: constraints.maxWidth < maxWidth
                        ? constraints.maxWidth
                        : maxWidth,
                    child: AspectRatio(
                      aspectRatio: 4 / 3,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(NexoraRadius.card),
                        child: _cameraOn
                            ? MobileScanner(
                                controller: _controller,
                                onDetect: _onDetect,
                                errorBuilder: (context, error) => _CameraPanel(
                                  icon: Icons.no_photography_outlined,
                                  title: l10n.scanPermissionTitle,
                                  body: l10n.scanPermissionDenied,
                                  actionLabel: l10n.scanStartCamera,
                                  onAction: _startCamera,
                                ),
                                overlayBuilder: (context, constraints) =>
                                    const _ScanFrame(),
                              )
                            : _CameraPanel(
                                icon: _permissionDenied
                                    ? Icons.no_photography_outlined
                                    : Icons.qr_code_scanner_rounded,
                                title: _permissionDenied
                                    ? l10n.scanPermissionTitle
                                    : l10n.scanCameraActive,
                                body: _permissionDenied
                                    ? l10n.scanPermissionDenied
                                    : l10n.scanPermissionBody,
                                actionLabel: l10n.scanStartCamera,
                                onAction: _startCamera,
                              ),
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: NexoraSpace.sm),
            Text(
              l10n.scanKeepInside,
              textAlign: TextAlign.center,
              style: context.texts.bodySmall,
            ),
            const SizedBox(height: NexoraSpace.lg),
            SectionHeader(title: l10n.scanEnterManually),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manual,
                    focusNode: _focus,
                    autocorrect: false,
                    enableSuggestions: false,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: l10n.scanPlaceholder,
                      prefixIcon: const Icon(Icons.keyboard_alt_outlined),
                    ),
                    onSubmitted: _resolve,
                  ),
                ),
                const SizedBox(width: NexoraSpace.sm),
                FilledButton(
                  onPressed: _busy ? null : () => _resolve(_manual.text),
                  child: _busy
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.scanResolve),
                ),
              ],
            ),
            const SizedBox(height: NexoraSpace.sm),
            Text(l10n.scanHardwareHint, style: context.texts.bodySmall),
            if (_message != null) ...[
              const SizedBox(height: NexoraSpace.lg),
              NexoraCard(
                child: Row(
                  children: [
                    Icon(
                      Icons.error_outline_rounded,
                      color: context.colors.error,
                    ),
                    const SizedBox(width: NexoraSpace.sm),
                    Expanded(
                      child: Text(_message!, style: context.texts.bodyMedium),
                    ),
                  ],
                ),
              ),
            ],
          ] else
            switch (result) {
              ScanProductResult product => _ProductScanResult(
                result: product,
                canWrite: canWrite,
                onAdd: () => _addProduct(product),
                onView: () => context.push('/products/${product.product.id}'),
              ),
              ScanDeviceResult device => _DeviceScanResult(
                device: device.device,
                canWrite: canWrite,
                onSell: () => _addDevice(device.device),
                onView: () => context.push('/devices/${device.device.id}'),
              ),
              ScanTrackedItemResult tracked => _TrackedItemScanResult(
                item: tracked.item,
                product: tracked.product,
                events: tracked.events,
                onView: () => context.push('/products/${tracked.product.id}'),
                onPrint: () => _printLabel(tracked.item),
              ),
            },
          if (result != null) ...[
            const SizedBox(height: NexoraSpace.lg),
            OutlinedButton.icon(
              onPressed: () => setState(() {
                _result = null;
                _message = null;
                _lastCode = null;
              }),
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: Text(l10n.scanScanning),
            ),
          ],
        ],
      ),
    );
  }
}

class _CameraPanel extends StatelessWidget {
  const _CameraPanel({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Container(
    color: context.isDark ? NexoraColors.darkSurfaceRaised : NexoraColors.ink,
    child: LayoutBuilder(
      builder: (context, constraints) {
        // The preview shrinks on short windows; drop the explanation rather
        // than clipping the action.
        final compact = constraints.maxHeight < 240;
        return Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(compact ? NexoraSpace.md : NexoraSpace.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: compact ? 28 : 40, color: Colors.white70),
                SizedBox(height: compact ? NexoraSpace.xs : NexoraSpace.sm),
                Text(
                  title,
                  style: context.texts.titleSmall?.copyWith(
                    color: Colors.white,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (!compact) ...[
                  const SizedBox(height: 4),
                  Text(
                    body,
                    style: context.texts.bodySmall?.copyWith(
                      color: Colors.white70,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                SizedBox(height: compact ? NexoraSpace.sm : NexoraSpace.md),
                FilledButton.icon(
                  onPressed: onAction,
                  icon: const Icon(Icons.videocam_rounded),
                  label: Text(actionLabel),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _ScanFrame extends StatelessWidget {
  const _ScanFrame();

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Center(
      child: Container(
        width: 220,
        height: 160,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white, width: 2),
          borderRadius: BorderRadius.circular(18),
        ),
      ),
    ),
  );
}

class _ProductScanResult extends StatelessWidget {
  const _ProductScanResult({
    required this.result,
    required this.canWrite,
    required this.onAdd,
    required this.onView,
  });

  final ScanProductResult result;
  final bool canWrite;
  final VoidCallback onAdd;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final product = result.product;
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: context.colors.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.inventory_2_rounded,
                  color: context.colors.primary,
                ),
              ),
              const SizedBox(width: NexoraSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.scanProductFound, style: context.texts.bodySmall),
                    Text(product.name, style: context.texts.titleMedium),
                    Text(
                      product.sku,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              if (product.isSerialized)
                StatusPill(
                  label: l10n.inventorySerialized,
                  tone: PillTone.primary,
                ),
            ],
          ),
          const SizedBox(height: NexoraSpace.md),
          Row(
            children: [
              Expanded(
                child: _Totals(
                  label: l10n.homeOnHand,
                  value: result.totals.onHand,
                ),
              ),
              Expanded(
                child: _Totals(
                  label: l10n.homeReserved,
                  value: result.totals.reserved,
                ),
              ),
              Expanded(
                child: _Totals(
                  label: l10n.homeAvailable,
                  value: result.totals.available,
                ),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.md),
          Text(l10n.scanStockLines, style: context.texts.titleSmall),
          const SizedBox(height: NexoraSpace.sm),
          if (result.stockLines.isEmpty)
            Text(l10n.commonEmpty, style: context.texts.bodySmall)
          else
            for (final line in result.stockLines)
              KeyValueRow(
                label: '${line.warehouseCode} · ${line.locationCode}',
                value: formatQuantity(line.available),
              ),
          const SizedBox(height: NexoraSpace.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onView,
                  child: Text(l10n.scanViewProduct),
                ),
              ),
              if (canWrite) ...[
                const SizedBox(width: NexoraSpace.sm),
                Expanded(
                  child: FilledButton(
                    onPressed: onAdd,
                    child: Text(
                      product.isSerialized
                          ? l10n.saleChooseDevice
                          : l10n.scanAddToBasket,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _DeviceScanResult extends StatelessWidget {
  const _DeviceScanResult({
    required this.device,
    required this.canWrite,
    required this.onSell,
    required this.onView,
  });

  final Device device;
  final bool canWrite;
  final VoidCallback onSell;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: context.colors.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.smartphone_rounded,
                  color: context.colors.primary,
                ),
              ),
              const SizedBox(width: NexoraSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.scanDeviceFound, style: context.texts.bodySmall),
                    Text(device.productName, style: context.texts.titleMedium),
                    Text(
                      device.serialNumber,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: deviceStatusLabel(context.l10n, device.status),
                tone: deviceStatusTone(device.status),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.md),
          KeyValueRow(
            label: l10n.devicesCondition,
            value: deviceConditionLabel(l10n, device.condition),
          ),
          KeyValueRow(label: l10n.commonSku, value: device.productSku),
          if (device.imei != null)
            KeyValueRow(label: l10n.commonImei, value: device.imei!),
          KeyValueRow(
            label: l10n.commonLocation,
            value: '${device.warehouseCode} · ${device.locationCode}',
          ),
          const SizedBox(height: NexoraSpace.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onView,
                  child: Text(l10n.commonDetails),
                ),
              ),
              if (canWrite) ...[
                const SizedBox(width: NexoraSpace.sm),
                Expanded(
                  child: FilledButton(
                    onPressed: device.isSellable ? onSell : null,
                    child: Text(l10n.scanUseDeviceToSell),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _TrackedItemScanResult extends StatelessWidget {
  const _TrackedItemScanResult({
    required this.item,
    required this.product,
    required this.events,
    required this.onView,
    required this.onPrint,
  });

  final TrackedItemSummary item;
  final Product product;
  final List<TrackedItemEvent> events;
  final VoidCallback onView;
  final VoidCallback onPrint;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: context.colors.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.qr_code_2_rounded,
                  color: context.colors.primary,
                ),
              ),
              const SizedBox(width: NexoraSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.scanTrackedItemFound,
                      style: context.texts.bodySmall,
                    ),
                    Text(item.productName, style: context.texts.titleMedium),
                    Text(
                      item.unitCode,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: trackedItemStatusLabel(l10n, item.status),
                tone: trackedItemStatusTone(item.status),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.md),
          KeyValueRow(label: l10n.commonSku, value: product.sku),
          if (product.barcode != null)
            KeyValueRow(
              label: l10n.scanProductBarcode,
              value: product.barcode!,
            ),
          if (item.serialNumber != null)
            KeyValueRow(
              label: l10n.scanSerialNumber,
              value: item.serialNumber!,
            ),
          if (item.imei != null)
            KeyValueRow(label: l10n.commonImei, value: item.imei!),
          KeyValueRow(
            label: l10n.commonLocation,
            value: '${item.warehouseCode} · ${item.locationCode}',
          ),
          if (item.purchaseOrderNumber != null)
            KeyValueRow(
              label: l10n.scanPurchaseOrder,
              value: item.purchaseOrderNumber!,
            ),
          KeyValueRow(
            label: l10n.scanReceivedAt,
            value: formatDate(item.receivedAt),
          ),
          const SizedBox(height: NexoraSpace.md),
          Text(l10n.scanHistory, style: context.texts.titleSmall),
          const SizedBox(height: NexoraSpace.sm),
          if (events.isEmpty)
            Text(l10n.scanNoHistory, style: context.texts.bodySmall)
          else
            for (final event in events)
              Padding(
                padding: const EdgeInsets.only(bottom: NexoraSpace.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.history_rounded,
                      size: 16,
                      color: context.colors.onSurfaceVariant,
                    ),
                    const SizedBox(width: NexoraSpace.xs),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            trackedItemEventLabel(l10n, event.eventType),
                            style: context.texts.bodyMedium,
                          ),
                          if (event.statusFrom != null &&
                              event.statusTo != null)
                            Text(
                              '${trackedItemStatusLabel(l10n, event.statusFrom!)}'
                              ' → '
                              '${trackedItemStatusLabel(l10n, event.statusTo!)}',
                              style: context.texts.bodySmall,
                            ),
                          if (event.note != null)
                            Text(event.note!, style: context.texts.bodySmall),
                        ],
                      ),
                    ),
                    Text(
                      formatDate(event.createdAt),
                      style: context.texts.bodySmall,
                    ),
                  ],
                ),
              ),
          const SizedBox(height: NexoraSpace.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onPrint,
                  icon: const Icon(Icons.print_outlined),
                  label: Text(l10n.scanPrintLabel),
                ),
              ),
              const SizedBox(width: NexoraSpace.sm),
              Expanded(
                child: FilledButton(
                  onPressed: onView,
                  child: Text(l10n.scanViewProduct),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: context.texts.bodySmall),
      QuantityText(value, style: context.texts.titleMedium),
    ],
  );
}
