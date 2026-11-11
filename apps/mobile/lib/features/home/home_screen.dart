import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/reports.dart';
import '../../data/models/stock.dart';
import '../../data/providers.dart';
import '../shell/organization_switcher.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(reportOverviewProvider);
    ref.invalidate(lowStockProvider);
    ref.invalidate(movementsProvider);
    ref.invalidate(stockSummaryProvider);
    await ref.read(
      reportOverviewProvider((warehouseId: null, days: 30)).future,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final membership = session.membership;
    final overview = ref.watch(
      reportOverviewProvider((warehouseId: null, days: 30)),
    );
    final lowStock = ref.watch(lowStockProvider((warehouseId: null, page: 1)));
    final movements = ref.watch(
      movementsProvider((
        page: 1,
        productId: null,
        warehouseId: null,
        type: null,
      )),
    );
    final l10n = context.l10n;
    final alertCount = lowStock.value?.total ?? 0;

    final online = overview.hasError
        ? false
        : (overview.isLoading ? null : true);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.navHome, style: context.texts.titleLarge),
            Text(
              membership?.organizationName ?? '',
              style: context.texts.bodySmall,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: l10n.orgSwitch,
            onPressed: () => showOrganizationSwitcher(context, ref),
            icon: const Icon(Icons.swap_horiz_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            Row(
              children: [
                _HealthDot(online: online),
                const SizedBox(width: NexoraSpace.sm),
                Text(
                  online == null
                      ? l10n.homeHealthChecking
                      : online
                      ? l10n.homeHealthOnline
                      : l10n.homeHealthOffline,
                  style: context.texts.bodySmall,
                ),
                const Spacer(),
                if (overview.value != null)
                  Text(
                    l10n.homeStale(formatTime(overview.value!.generatedAt)),
                    style: context.texts.bodySmall,
                  ),
              ],
            ),
            const SizedBox(height: NexoraSpace.md),
            _ValuationCard(overview: overview),
            const SizedBox(height: NexoraSpace.xl),
            SectionHeader(title: l10n.homeStartOperation),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => context.go('/sell'),
                    icon: const Icon(Icons.point_of_sale_rounded),
                    label: Text(l10n.homeNewSale),
                  ),
                ),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/scan'),
                    icon: const Icon(Icons.qr_code_scanner_rounded),
                    label: Text(l10n.homeScanItem),
                  ),
                ),
              ],
            ),
            const SizedBox(height: NexoraSpace.xl),
            SectionHeader(
              title: l10n.homeNeedsAttention,
              actionLabel: alertCount > 0
                  ? l10n.homeAllAlerts(alertCount)
                  : null,
              onAction: alertCount > 0
                  ? () => context.push('/reports/low-stock')
                  : null,
            ),
            lowStock.when(
              data: (page) => page.items.isEmpty
                  ? NexoraCard(
                      child: Row(
                        children: [
                          Icon(
                            Icons.check_circle_outline_rounded,
                            color: context.colors.tertiary,
                          ),
                          const SizedBox(width: NexoraSpace.sm),
                          Expanded(
                            child: Text(
                              l10n.homeLowStockEmpty,
                              style: context.texts.bodyMedium,
                            ),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        for (final item in page.items.take(3))
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: NexoraSpace.sm,
                            ),
                            child: _LowStockRow(item: item),
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
                onRetry: () => ref.invalidate(lowStockProvider),
                compact: true,
              ),
            ),
            const SizedBox(height: NexoraSpace.xl),
            SectionHeader(
              title: l10n.homeRecentActivity,
              actionLabel: l10n.commonViewAll,
              onAction: () => context.push('/stock/movements'),
            ),
            movements.when(
              data: (page) => page.items.isEmpty
                  ? NexoraCard(
                      child: Text(
                        l10n.homeNoActivity,
                        style: context.texts.bodyMedium,
                      ),
                    )
                  : Column(
                      children: [
                        for (final movement in page.items.take(5))
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: NexoraSpace.sm,
                            ),
                            child: _MovementRow(movement: movement),
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
                onRetry: () => ref.invalidate(movementsProvider),
                compact: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HealthDot extends StatelessWidget {
  const _HealthDot({required this.online});

  final bool? online;

  @override
  Widget build(BuildContext context) {
    final color = online == null
        ? context.colors.onSurfaceVariant
        : online!
        ? NexoraColors.success
        : NexoraColors.danger;
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _ValuationCard extends StatelessWidget {
  const _ValuationCard({required this.overview});

  final AsyncValue<ReportOverview> overview;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final data = overview.value;
    final totals = data?.totals;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NexoraRadius.card),
        gradient: const LinearGradient(
          colors: [Color(0xFF4F46E5), Color(0xFF6D5CF5)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.homeStockValuation,
            style: context.texts.labelMedium?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: NexoraSpace.sm),
          if (data != null)
            MoneyText(
              data.valuation.saleValueMinor,
              style: context.texts.headlineLarge?.copyWith(color: Colors.white),
            )
          else if (overview.hasError)
            Text(
              l10n.homeHealthOffline,
              style: context.texts.bodyMedium?.copyWith(color: Colors.white70),
            )
          else
            const SizedBox(
              height: 34,
              width: 34,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            ),
          const SizedBox(height: NexoraSpace.lg),
          Row(
            children: [
              _ValuationStat(label: l10n.homeOnHand, value: totals?.onHand),
              Container(width: 1, height: 32, color: Colors.white24),
              _ValuationStat(label: l10n.homeReserved, value: totals?.reserved),
              Container(width: 1, height: 32, color: Colors.white24),
              _ValuationStat(
                label: l10n.homeAvailable,
                value: totals?.available,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ValuationStat extends StatelessWidget {
  const _ValuationStat({required this.label, required this.value});

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.texts.bodySmall?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 2),
          if (value == null)
            const Text('—', style: TextStyle(color: Colors.white))
          else
            QuantityText(
              value!,
              style: context.texts.titleMedium?.copyWith(color: Colors.white),
            ),
        ],
      ),
    ),
  );
}

class _LowStockRow extends StatelessWidget {
  const _LowStockRow({required this.item});

  final LowStockItem item;

  @override
  Widget build(BuildContext context) => NexoraCard(
    padding: const EdgeInsets.all(NexoraSpace.md),
    onTap: () => context.push('/products/${item.productId}'),
    child: Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: NexoraColors.dangerSoft,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(
            Icons.trending_down_rounded,
            color: NexoraColors.danger,
            size: 20,
          ),
        ),
        const SizedBox(width: NexoraSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.productName,
                style: context.texts.titleSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(item.sku, style: context.texts.bodySmall),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            StatusPill(
              label: context.l10n.inventoryLowStock,
              tone: PillTone.warning,
            ),
            const SizedBox(height: 4),
            Text(
              '${context.l10n.reportsShortfall} ${formatQuantity(item.shortfall)}',
              style: context.texts.bodySmall,
              textDirection: TextDirection.ltr,
            ),
          ],
        ),
      ],
    ),
  );
}

class _MovementRow extends StatelessWidget {
  const _MovementRow({required this.movement});

  final StockMovement movement;

  @override
  Widget build(BuildContext context) {
    final received = movement.quantityDelta >= 0;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Icon(
            received
                ? Icons.arrow_downward_rounded
                : Icons.arrow_upward_rounded,
            color: received ? NexoraColors.success : NexoraColors.danger,
            size: 20,
          ),
          const SizedBox(width: NexoraSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  movement.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${movementTypeLabel(context.l10n, movement.type)} · '
                  '${movement.warehouseCode}/${movement.locationCode}',
                  style: context.texts.bodySmall,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${received ? '+' : ''}${formatQuantity(movement.quantityDelta)}',
                style: context.texts.titleSmall?.copyWith(
                  color: received ? NexoraColors.success : NexoraColors.danger,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
                textDirection: TextDirection.ltr,
              ),
              Text(
                formatTime(movement.createdAt),
                style: context.texts.bodySmall,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
