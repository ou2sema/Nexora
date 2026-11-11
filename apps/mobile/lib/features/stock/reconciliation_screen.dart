import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/stock.dart';
import '../../data/providers.dart';

class ReconciliationScreen extends ConsumerStatefulWidget {
  const ReconciliationScreen({super.key});

  @override
  ConsumerState<ReconciliationScreen> createState() =>
      _ReconciliationScreenState();
}

class _ReconciliationScreenState extends ConsumerState<ReconciliationScreen> {
  bool _busy = false;

  Future<void> _repair({required bool dryRun}) async {
    final l10n = context.l10n;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    if (!dryRun) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(l10n.stockRepair),
          content: Text(l10n.stockReconcileBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(l10n.commonCancel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(l10n.stockRepair),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() => _busy = true);
    try {
      final rows = await ref
          .read(nexoraApiProvider)
          .reconcileStock(organizationId, dryRun: dryRun);
      ref.invalidate(reconciliationProvider);
      if (!dryRun) {
        ref.invalidate(stockLevelsProvider);
        ref.invalidate(stockSummaryProvider);
        ref.invalidate(movementsProvider);
        ref.invalidate(reportOverviewProvider);
      }
      if (!mounted) return;
      if (dryRun) {
        await _showDryRun(rows);
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.stockRepairApplied)));
      }
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

  Future<void> _showDryRun(List<StockRepairRow> rows) => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(context.l10n.stockDryRun),
      content: SizedBox(
        width: double.maxFinite,
        child: rows.isEmpty
            ? Text(context.l10n.stockBalanced)
            : ListView(
                shrinkWrap: true,
                children: [
                  for (final row in rows)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(row.productName),
                      subtitle: Text(
                        '${row.warehouseCode}/${row.locationCode} · '
                        '${formatQuantity(row.previousOnHand)} → ${formatQuantity(row.ledgerOnHand)}',
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                ],
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(context.l10n.commonClose),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final rows = ref.watch(reconciliationProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.stockReconciliation),
        actions: [
          IconButton(
            tooltip: l10n.commonRefresh,
            onPressed: () => ref.invalidate(reconciliationProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(reconciliationProvider.future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            NexoraCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.fact_check_outlined,
                    color: context.colors.primary,
                  ),
                  const SizedBox(width: NexoraSpace.md),
                  Expanded(
                    child: Text(
                      l10n.stockReconcileBody,
                      style: context.texts.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: NexoraSpace.lg),
            rows.when(
              data: (items) => items.isEmpty
                  ? NexoraCard(
                      child: Row(
                        children: [
                          Icon(
                            Icons.check_circle_outline_rounded,
                            color: context.colors.tertiary,
                          ),
                          const SizedBox(width: NexoraSpace.md),
                          Expanded(child: Text(l10n.stockBalanced)),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        for (final row in items)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: NexoraSpace.sm,
                            ),
                            child: _ReconciliationRow(row: row),
                          ),
                      ],
                    ),
              loading: () => const Padding(
                padding: EdgeInsets.all(NexoraSpace.xl),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => FailureView(
                failure: failureOf(error),
                onRetry: () => ref.invalidate(reconciliationProvider),
                compact: true,
              ),
            ),
            if (role.canReconcile) ...[
              const SizedBox(height: NexoraSpace.lg),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _repair(dryRun: true),
                      child: Text(l10n.stockDryRun),
                    ),
                  ),
                  const SizedBox(width: NexoraSpace.md),
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy ? null : () => _repair(dryRun: false),
                      child: _busy
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(l10n.stockRepair),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReconciliationRow extends StatelessWidget {
  const _ReconciliationRow({required this.row});

  final StockReconciliationRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  row.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              StatusPill(
                label: row.balanced
                    ? l10n.stockBalanced
                    : formatQuantity(row.difference),
                tone: row.balanced ? PillTone.success : PillTone.danger,
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(
            '${row.productSku} · ${row.warehouseCode}/${row.locationCode}',
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
          const SizedBox(height: NexoraSpace.sm),
          Row(
            children: [
              Expanded(
                child: _Figure(
                  label: l10n.stockBalance,
                  value: row.balanceOnHand,
                ),
              ),
              Expanded(
                child: _Figure(
                  label: l10n.stockLedger,
                  value: row.ledgerOnHand,
                ),
              ),
              Expanded(
                child: _Figure(
                  label: l10n.stockDifference,
                  value: row.difference,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: context.texts.bodySmall),
      QuantityText(value, style: context.texts.titleSmall),
    ],
  );
}
