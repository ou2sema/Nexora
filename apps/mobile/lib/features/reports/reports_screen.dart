import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/reports.dart';
import '../../data/providers.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  int _days = 30;
  String? _warehouseId;
  bool _exporting = false;

  Future<void> _export(Future<void> Function() run) async {
    setState(() => _exporting = true);
    try {
      await run();
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final organizationId = ref.watch(organizationIdProvider);
    final api = ref.watch(nexoraApiProvider);
    final warehouses = ref.watch(warehousesProvider);
    final overview = ref.watch(
      reportOverviewProvider((warehouseId: _warehouseId, days: _days)),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.reportsTitle),
        actions: [
          IconButton(
            tooltip: l10n.commonRefresh,
            onPressed: () => ref.invalidate(reportOverviewProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(
          reportOverviewProvider((warehouseId: _warehouseId, days: _days))
              .future,
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final days in [7, 30, 90])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(l10n.reportsDays(days)),
                        selected: _days == days,
                        onSelected: (_) => setState(() => _days = days),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: NexoraSpace.sm),
            SizedBox(
              height: 40,
              child: warehouses.when(
                data: (items) => ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(l10n.commonAllWarehouses),
                        selected: _warehouseId == null,
                        onSelected: (_) => setState(() => _warehouseId = null),
                      ),
                    ),
                    for (final warehouse in items)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(warehouse.code),
                          selected: _warehouseId == warehouse.id,
                          onSelected: (_) =>
                              setState(() => _warehouseId = warehouse.id),
                        ),
                      ),
                  ],
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            AsyncPane(
              value: overview,
              onRetry: () => ref.invalidate(reportOverviewProvider),
              builder: (overview) => _OverviewBody(overview: overview),
            ),
            const SizedBox(height: NexoraSpace.lg),
            NexoraCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.warning_amber_rounded),
                    title: Text(l10n.reportsLowStock),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/reports/low-stock'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.local_shipping_outlined),
                    title: Text(l10n.reportsSupplierPerformance),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/reports/supplier-performance'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: NexoraSpace.lg),
            OutlinedButton.icon(
              onPressed: organizationId == null || _exporting
                  ? null
                  : () => _export(
                      () => downloadDocument(
                        context,
                        () => api.stockLevelsCsv(
                          organizationId,
                          warehouseId: _warehouseId,
                        ),
                      ),
                    ),
              icon: const Icon(Icons.download_rounded),
              label: Text(l10n.reportsExportStockLevels),
            ),
            const SizedBox(height: NexoraSpace.sm),
            OutlinedButton.icon(
              onPressed: organizationId == null || _exporting
                  ? null
                  : () => _export(
                      () => downloadDocument(
                        context,
                        () => api.movementsCsv(
                          organizationId,
                          warehouseId: _warehouseId,
                          from: DateTime.now()
                              .toUtc()
                              .subtract(Duration(days: _days))
                              .toIso8601String(),
                          to: DateTime.now().toUtc().toIso8601String(),
                        ),
                      ),
                    ),
              icon: const Icon(Icons.download_rounded),
              label: Text(l10n.reportsExportMovements),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverviewBody extends StatelessWidget {
  const _OverviewBody({required this.overview});

  final ReportOverview overview;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final totals = overview.totals;
    final valuation = overview.valuation;
    final movements = overview.movements;
    final generatedAt = overview.generatedAt;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NexoraCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.reportsOverview,
                      style: context.texts.titleMedium,
                    ),
                  ),
                  if (generatedAt != null)
                    Text(
                      l10n.reportsGeneratedAt(formatDateTime(generatedAt)),
                      style: context.texts.bodySmall,
                    ),
                ],
              ),
              const Divider(height: NexoraSpace.lg),
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      label: l10n.homeOnHand,
                      value: formatQuantity(totals.onHand),
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: l10n.homeReserved,
                      value: formatQuantity(totals.reserved),
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: l10n.homeAvailable,
                      value: formatQuantity(totals.available),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NexoraSpace.md),
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      label: l10n.reportsProducts,
                      value: '${totals.productCount}',
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: l10n.reportsWarehouses,
                      value: '${totals.warehouseCount}',
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: l10n.inventorySerialized,
                      value: '${totals.serializedInStock}',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: NexoraSpace.md),
        NexoraCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _Metric(
                      label: l10n.reportsPurchases,
                      value: Money.format(valuation.purchaseValueMinor),
                    ),
                  ),
                  Expanded(
                    child: _Metric(
                      label: l10n.reportsSales,
                      value: Money.format(valuation.saleValueMinor),
                    ),
                  ),
                ],
              ),
              if (valuation.unpricedProductCount > 0) ...[
                const SizedBox(height: NexoraSpace.sm),
                Text(
                  l10n.reportsUnpriced(valuation.unpricedProductCount),
                  style: context.texts.bodySmall,
                ),
              ],
              const Divider(height: NexoraSpace.lg),
              Text(l10n.reportsMovements, style: context.texts.titleSmall),
              const SizedBox(height: NexoraSpace.sm),
              KeyValueRow(
                label: l10n.reportsReceived,
                value: formatQuantity(movements.receivedQuantity),
              ),
              KeyValueRow(
                label: l10n.reportsIssued,
                value: formatQuantity(movements.issuedQuantity),
              ),
              KeyValueRow(
                label: l10n.stockAdjustment,
                value: formatQuantity(movements.adjustedQuantity),
              ),
              KeyValueRow(
                label: l10n.reportsNet,
                value: formatQuantity(movements.netQuantity),
              ),
            ],
          ),
        ),
        const SizedBox(height: NexoraSpace.md),
        SectionHeader(title: l10n.reportsWarehouses),
        if (overview.warehouses.isEmpty)
          Text(l10n.reportsNoData, style: context.texts.bodyMedium)
        else
          for (final row in overview.warehouses)
            Padding(
              padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
              child: NexoraCard(
                padding: const EdgeInsets.all(NexoraSpace.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${row.code} · ${row.name}',
                            style: context.texts.titleSmall,
                          ),
                        ),
                        QuantityText(
                          row.available,
                          style: context.texts.titleSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: NexoraSpace.xs),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${l10n.inventoryOnHandShort} ${formatQuantity(row.onHand)} · '
                            '${l10n.inventoryReservedShort} ${formatQuantity(row.reserved)}',
                            style: context.texts.bodySmall,
                          ),
                        ),
                        Text(
                          Money.format(row.purchaseValueMinor),
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
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: context.texts.bodySmall),
      const SizedBox(height: NexoraSpace.xs),
      Text(
        value,
        style: context.texts.titleSmall,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textDirection: TextDirection.ltr,
      ),
    ],
  );
}
