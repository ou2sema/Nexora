import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/providers.dart';

class SupplierPerformanceScreen extends ConsumerStatefulWidget {
  const SupplierPerformanceScreen({super.key});

  @override
  ConsumerState<SupplierPerformanceScreen> createState() =>
      _SupplierPerformanceScreenState();
}

class _SupplierPerformanceScreenState
    extends ConsumerState<SupplierPerformanceScreen> {
  int _days = 90;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final report = ref.watch(supplierPerformanceProvider((days: _days)));

    return Scaffold(
      appBar: AppBar(title: Text(l10n.reportsSupplierPerformance)),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              scrollDirection: Axis.horizontal,
              children: [
                for (final days in [30, 90, 365])
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
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                supplierPerformanceProvider((days: _days)).future,
              ),
              child: report.when(
                data: (report) => report.suppliers.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.insights_outlined,
                            title: l10n.reportsNoData,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        children: [
                          for (final row in report.suppliers)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: NexoraCard(
                                padding: const EdgeInsets.all(NexoraSpace.md),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            row.supplierName,
                                            style: context.texts.titleSmall,
                                          ),
                                        ),
                                        if (row.onTimeRate != null)
                                          StatusPill(
                                            label:
                                                '${l10n.reportsOnTime} '
                                                '${_percent(row.onTimeRate!)}',
                                            tone: row.onTimeRate! >= 0.9
                                                ? PillTone.success
                                                : row.onTimeRate! >= 0.7
                                                ? PillTone.warning
                                                : PillTone.danger,
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: NexoraSpace.sm),
                                    KeyValueRow(
                                      label: l10n.reportsOrdersCreated,
                                      value: '${row.ordersCreated}',
                                    ),
                                    KeyValueRow(
                                      label: l10n.reportsOrdersReceived,
                                      value: '${row.ordersReceived}',
                                    ),
                                    KeyValueRow(
                                      label: l10n.reportsPurchases,
                                      value: Money.format(
                                        row.receivedValueMinor,
                                      ),
                                    ),
                                    KeyValueRow(
                                      label: l10n.reportsAvgLeadTime,
                                      value: row.averageLeadTimeDays == null
                                          ? '—'
                                          : formatQuantity(
                                              row.averageLeadTimeDays!,
                                            ),
                                    ),
                                    KeyValueRow(
                                      label: l10n.reportsReturnRate,
                                      value: row.returnRate == null
                                          ? '—'
                                          : _percent(row.returnRate!),
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
                  onRetry: () => ref.invalidate(supplierPerformanceProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _percent(double value) => '${(value * 100).toStringAsFixed(1)}%';
