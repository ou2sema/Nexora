import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/devices.dart';
import '../../data/providers.dart';

class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key, this.productId});

  final String? productId;

  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String? _status;
  int _page = 1;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() {
        _search = value.trim();
        _page = 1;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final devices = ref.watch(
      devicesProvider((
        search: _search,
        status: _status,
        productId: widget.productId,
        page: _page,
      )),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.devicesTitle),
        actions: [
          IconButton(
            tooltip: l10n.devicesRegister,
            onPressed: () => context.push(
              widget.productId == null
                  ? '/devices/new'
                  : '/devices/new?productId=${widget.productId}',
            ),
            icon: const Icon(Icons.add_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SearchField(
              hint: l10n.devicesSearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: DropdownButtonFormField<String?>(
              initialValue: _status,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.devicesStatus),
              items: [
                DropdownMenuItem(
                  value: null,
                  child: Text(l10n.devicesAllStatuses),
                ),
                for (final status in DeviceStatus.values)
                  DropdownMenuItem(
                    value: status.wire,
                    child: Text(deviceStatusLabel(l10n, status)),
                  ),
              ],
              onChanged: (value) => setState(() {
                _status = value;
                _page = 1;
              }),
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                devicesProvider((
                  search: _search,
                  status: _status,
                  productId: widget.productId,
                  page: _page,
                )).future,
              ),
              child: devices.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.devices_other_outlined,
                            title: l10n.commonEmpty,
                            message: l10n.devicesNoDevices,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final device in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _DeviceRow(
                                device: device,
                                onTap: () =>
                                    context.push('/devices/${device.id}'),
                              ),
                            ),
                          ListPager(
                            page: page.page,
                            pages: page.pageCount,
                            onPrevious: _page > 1
                                ? () => setState(() => _page--)
                                : null,
                            onNext: page.hasMore
                                ? () => setState(() => _page++)
                                : null,
                          ),
                        ],
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  onRetry: () => ref.invalidate(devicesProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeviceRow extends StatelessWidget {
  const _DeviceRow({required this.device, required this.onTap});

  final Device device;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  device.imei == null
                      ? device.serialNumber
                      : '${device.serialNumber} · ${device.imei}',
                  style: context.texts.bodySmall,
                  textDirection: TextDirection.ltr,
                ),
                Text(
                  '${device.warehouseCode}/${device.locationCode} · '
                  '${deviceConditionLabel(l10n, device.condition)}',
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: NexoraSpace.sm),
          StatusPill(
            label: deviceStatusLabel(l10n, device.status),
            tone: deviceStatusTone(device.status),
          ),
        ],
      ),
    );
  }
}
