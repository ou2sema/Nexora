import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/scanning.dart';
import '../../data/providers.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  bool _busy = false;

  Future<void> _assignBarcode() async {
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(nexoraApiProvider)
          .assignBarcode(organizationId, widget.productId);
      ref.invalidate(productProvider(widget.productId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.barcode),
            action: SnackBarAction(
              label: context.l10n.commonDone,
              onPressed: () =>
                  Clipboard.setData(ClipboardData(text: result.barcode)),
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(context.l10n, failureOf(error)))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _labels(Product product) async {
    final copies = await showDialog<int>(
      context: context,
      builder: (context) => const _CopiesDialog(),
    );
    if (copies == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    await downloadDocument(
      context,
      () => ref.read(nexoraApiProvider).labelSheet(organizationId, [
        LabelItem.product(product.id, copies: copies),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final productValue = ref.watch(productProvider(widget.productId));
    final products = ref.watch(
      devicesProvider((
        search: '',
        status: null,
        productId: widget.productId,
        page: 1,
      )),
    );
    final deviceCount = products.value?.total ?? 0;

    return productValue.when(
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(productProvider(widget.productId)),
        ),
      ),
      data: (product) => Scaffold(
        appBar: AppBar(
          title: Text(l10n.inventoryProductDetails),
          actions: [
            if (role.canWrite)
              IconButton(
                tooltip: l10n.commonEdit,
                onPressed: () => context.push(
                  '/products/${product.id}/edit',
                  extra: product,
                ),
                icon: const Icon(Icons.edit_outlined),
              ),
            const SizedBox(width: NexoraSpace.sm),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(productProvider(widget.productId));
            ref.invalidate(productStockProvider(widget.productId));
            ref.invalidate(devicesProvider);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              _ProductHeader(product: product),
              const SizedBox(height: NexoraSpace.lg),
              if (role.canWrite)
                Wrap(
                  spacing: NexoraSpace.sm,
                  runSpacing: NexoraSpace.sm,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        '/stock/movements/new?type=adjustment&productId=${product.id}',
                      ),
                      icon: const Icon(Icons.tune_rounded),
                      label: Text(l10n.stockAdjustment),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        '/stock/movements/new?type=receipt&productId=${product.id}',
                      ),
                      icon: const Icon(Icons.call_received_rounded),
                      label: Text(l10n.stockReceipt),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        '/stock/transfer?productId=${product.id}',
                      ),
                      icon: const Icon(Icons.swap_horiz_rounded),
                      label: Text(l10n.stockMove),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        '/stock/reservations/new?productId=${product.id}',
                      ),
                      icon: const Icon(Icons.lock_clock_outlined),
                      label: Text(l10n.stockReserve),
                    ),
                  ],
                ),
              const SizedBox(height: NexoraSpace.xl),
              SectionHeader(title: l10n.inventoryStockByLocation),
              _StockSection(
                productId: product.id,
                threshold: product.reorderThreshold,
              ),
              const SizedBox(height: NexoraSpace.xl),
              if (product.isSerialized) ...[
                SectionHeader(
                  title: l10n.inventoryDeviceTraceability,
                  actionLabel: deviceCount > 0
                      ? l10n.inventoryViewDevices(deviceCount)
                      : null,
                  onAction: deviceCount > 0
                      ? () => context.push('/devices?productId=${product.id}')
                      : null,
                ),
                products.when(
                  data: (page) => page.items.isEmpty
                      ? NexoraCard(
                          child: Text(
                            l10n.inventoryNoDevices,
                            style: context.texts.bodyMedium,
                          ),
                        )
                      : Column(
                          children: [
                            for (final device in page.items.take(3))
                              Padding(
                                padding: const EdgeInsets.only(
                                  bottom: NexoraSpace.sm,
                                ),
                                child: NexoraCard(
                                  padding: const EdgeInsets.all(NexoraSpace.md),
                                  onTap: () =>
                                      context.push('/devices/${device.id}'),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.qr_code_2_rounded),
                                      const SizedBox(width: NexoraSpace.md),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              device.serialNumber,
                                              style: context.texts.titleSmall,
                                              textDirection: TextDirection.ltr,
                                            ),
                                            Text(
                                              '${device.warehouseCode}/${device.locationCode}',
                                              style: context.texts.bodySmall,
                                            ),
                                          ],
                                        ),
                                      ),
                                      StatusPill(
                                        label: deviceStatusLabel(
                                          context.l10n,
                                          device.status,
                                        ),
                                        tone: deviceStatusTone(device.status),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, _) => FailureView(
                    failure: failureOf(error),
                    onRetry: () => ref.invalidate(devicesProvider),
                    compact: true,
                  ),
                ),
                const SizedBox(height: NexoraSpace.xl),
              ],
              SectionHeader(title: l10n.inventoryBarcode),
              NexoraCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    KeyValueRow(
                      label: l10n.inventoryBarcode,
                      value: product.barcode ?? '—',
                    ),
                    KeyValueRow(
                      label: l10n.inventoryInternalCode,
                      value: product.internalCode ?? '—',
                    ),
                    const SizedBox(height: NexoraSpace.sm),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _busy ? null : _assignBarcode,
                            icon: const Icon(Icons.qr_code_2_rounded),
                            label: Text(
                              product.barcode == null
                                  ? l10n.commonAdd
                                  : l10n.commonEdit,
                            ),
                          ),
                        ),
                        const SizedBox(width: NexoraSpace.sm),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _labels(product),
                            icon: const Icon(Icons.print_outlined),
                            label: Text(l10n.documentsLabels),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (product.description != null &&
                  product.description!.isNotEmpty) ...[
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.inventoryDescription),
                NexoraCard(
                  child: Text(
                    product.description!,
                    style: context.texts.bodyMedium,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductHeader extends StatelessWidget {
  const _ProductHeader({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: context.colors.primaryContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  product.isSerialized
                      ? Icons.smartphone_rounded
                      : product.isIndividuallyTracked
                      ? Icons.qr_code_2_rounded
                      : Icons.widgets_rounded,
                  color: context.colors.primary,
                  size: 26,
                ),
              ),
              const SizedBox(width: NexoraSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name, style: context.texts.titleLarge),
                    Text(
                      product.sku,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: product.isSerialized
                    ? l10n.inventorySerialized
                    : product.isIndividuallyTracked
                    ? l10n.inventoryIndividuallyTracked
                    : l10n.inventoryBulk,
                tone: product.isSerialized || product.isIndividuallyTracked
                    ? PillTone.primary
                    : PillTone.neutral,
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.lg),
          Row(
            children: [
              Expanded(
                child: _Amount(
                  label: l10n.inventoryCostMinor,
                  minor: product.purchasePriceMinor,
                ),
              ),
              Expanded(
                child: _Amount(
                  label: l10n.inventoryPriceMinor,
                  minor: product.salePriceMinor,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.inventoryReorderLevel,
                      style: context.texts.bodySmall,
                    ),
                    QuantityText(
                      product.reorderThreshold,
                      style: context.texts.titleMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (product.categoryName != null || product.brandName != null) ...[
            const SizedBox(height: NexoraSpace.md),
            Text(
              [
                product.categoryName,
                product.brandName,
              ].whereType<String>().join(' · '),
              style: context.texts.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _Amount extends StatelessWidget {
  const _Amount({required this.label, required this.minor});

  final String label;
  final int? minor;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: context.texts.bodySmall),
      if (minor == null)
        Text('—', style: context.texts.titleMedium)
      else
        MoneyText(minor!, style: context.texts.titleMedium),
    ],
  );
}

class _StockSection extends ConsumerWidget {
  const _StockSection({required this.productId, required this.threshold});

  final String productId;
  final double threshold;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stock = ref.watch(productStockProvider(productId));
    return stock.when(
      data: (lines) => lines.isEmpty
          ? NexoraCard(
              child: Text(
                context.l10n.commonEmpty,
                style: context.texts.bodyMedium,
              ),
            )
          : Column(
              children: [
                for (final line in lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                    child: NexoraCard(
                      padding: const EdgeInsets.all(NexoraSpace.md),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${line.warehouseCode} · ${line.locationCode}',
                                  style: context.texts.titleSmall,
                                  textDirection: TextDirection.ltr,
                                ),
                                Text(
                                  line.warehouseName,
                                  style: context.texts.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          StatusPill(
                            label: stockLevelToneLabel(
                              context.l10n,
                              line.available,
                              threshold,
                            ),
                            tone: stockLevelTone(line.available, threshold),
                          ),
                          const SizedBox(width: NexoraSpace.md),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              QuantityText(
                                line.available,
                                style: context.texts.titleMedium,
                              ),
                              Text(
                                '${context.l10n.inventoryAvailableShort} · '
                                '${context.l10n.inventoryOnHandShort} ${formatQuantity(line.onHand)}',
                                style: context.texts.bodySmall,
                                textDirection: TextDirection.ltr,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => FailureView(
        failure: failureOf(error),
        onRetry: () => ref.invalidate(productStockProvider(productId)),
        compact: true,
      ),
    );
  }
}

class _CopiesDialog extends StatefulWidget {
  const _CopiesDialog();

  @override
  State<_CopiesDialog> createState() => _CopiesDialogState();
}

class _CopiesDialogState extends State<_CopiesDialog> {
  final _controller = TextEditingController(text: '1');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copies = int.tryParse(_controller.text) ?? 0;
    return AlertDialog(
      title: Text(context.l10n.documentsSelectCopies),
      content: TextField(
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(prefixIcon: Icon(Icons.copy_rounded)),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(context.l10n.commonCancel),
        ),
        FilledButton(
          onPressed: copies > 0 && copies <= 50
              ? () => Navigator.of(context).pop(copies)
              : null,
          child: Text(context.l10n.commonCreate),
        ),
      ],
    );
  }
}
