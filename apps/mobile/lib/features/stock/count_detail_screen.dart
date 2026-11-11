import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/scanning.dart';
import '../../data/providers.dart';

class StockCountScreen extends ConsumerStatefulWidget {
  const StockCountScreen({super.key, required this.countId});

  final String countId;

  @override
  ConsumerState<StockCountScreen> createState() => _StockCountScreenState();
}

class _StockCountScreenState extends ConsumerState<StockCountScreen> {
  final _guard = IdempotencyGuard();
  bool _busy = false;

  void _show(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _invalidateAll() {
    ref.invalidate(stockCountProvider(widget.countId));
    ref.invalidate(stockCountsProvider);
  }

  Future<void> _addLine() async {
    final l10n = context.l10n;
    final product = await showProductPicker(context, onlyNotSerialized: true);
    if (product == null || !mounted) return;
    final entry = await showDialog<({double quantity, String mode})>(
      context: context,
      builder: (_) => _CountLineDialog(product: product),
    );
    if (entry == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .recordStockCount(
            organizationId,
            widget.countId,
            productId: product.id,
            quantity: entry.quantity,
            mode: entry.mode,
          );
      _invalidateAll();
      if (mounted) _show(l10n.commonSuccess);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _post() async {
    final l10n = context.l10n;
    final confirmed = await _confirm(l10n.stockPostCount, l10n.stockPostCount);
    if (confirmed != true) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .postStockCount(
              organizationId,
              widget.countId,
              idempotencyKey: key,
            ),
      );
      _invalidateAll();
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      ref.invalidate(movementsProvider);
      ref.invalidate(reportOverviewProvider);
      ref.invalidate(lowStockProvider);
      if (mounted) _show(l10n.stockCountPosted);
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _discard() async {
    final l10n = context.l10n;
    final confirmed = await _confirm(
      l10n.stockDiscardCount,
      l10n.stockDiscardCount,
    );
    if (confirmed != true) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .discardStockCount(organizationId, widget.countId);
      _invalidateAll();
      if (!mounted) return;
      _show(l10n.stockCountDiscarded);
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) _show(failureText(l10n, failureOf(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool?> _confirm(String title, String action) => showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(context.l10n.commonCancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(action),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final value = ref.watch(stockCountProvider(widget.countId));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.stockCountsTitle),
        actions: [
          IconButton(
            tooltip: l10n.commonRefresh,
            onPressed: () => ref.invalidate(stockCountProvider(widget.countId)),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(stockCountProvider(widget.countId)),
        ),
        data: (count) {
          final open = count.summary.status == StockCountStatus.open;
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(stockCountProvider(widget.countId).future),
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
                              '${count.summary.warehouseCode}/${count.summary.locationCode}',
                              style: context.texts.titleMedium,
                              textDirection: TextDirection.ltr,
                            ),
                          ),
                          StatusPill(
                            label: stockCountStatusLabel(
                              l10n,
                              count.summary.status,
                            ),
                            tone: stockCountStatusTone(count.summary.status),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      KeyValueRow(
                        label: l10n.commonDate,
                        value: formatDate(count.summary.createdAt),
                      ),
                      if (count.summary.postedAt != null)
                        KeyValueRow(
                          label: l10n.stockCountPosted,
                          value: formatDateTime(count.summary.postedAt),
                        ),
                      KeyValueRow(
                        label: l10n.stockCountLines,
                        value: '${count.lines.length}',
                      ),
                      if (count.summary.note != null)
                        KeyValueRow(
                          label: l10n.stockCountNote,
                          value: count.summary.note!,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: NexoraSpace.lg),
                SectionHeader(
                  title: l10n.stockCountLines,
                  actionLabel: open && role.canWrite
                      ? l10n.stockAddCountLine
                      : null,
                  onAction: open && role.canWrite ? _addLine : null,
                ),
                if (count.lines.isEmpty)
                  NexoraCard(
                    child: Text(
                      l10n.stockCountEmpty,
                      style: context.texts.bodyMedium,
                    ),
                  )
                else
                  for (final line in count.lines)
                    Padding(
                      padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                      child: _CountLineRow(line: line),
                    ),
                if (open && role.canWrite) ...[
                  const SizedBox(height: NexoraSpace.lg),
                  FilledButton(
                    onPressed: _busy ? null : _post,
                    child: _busy
                        ? const SizedBox.square(
                            dimension: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.stockPostCount),
                  ),
                  const SizedBox(height: NexoraSpace.sm),
                  OutlinedButton(
                    onPressed: _busy ? null : _discard,
                    child: Text(l10n.stockDiscardCount),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CountLineRow extends StatelessWidget {
  const _CountLineRow({required this.line});

  final StockCountLine line;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final positive = line.variance >= 0;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${line.productSku} · ${l10n.inventoryOnHandShort} '
                  '${formatQuantity(line.onHand)}',
                  style: context.texts.bodySmall,
                  textDirection: TextDirection.ltr,
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              QuantityText(
                line.countedQuantity,
                style: context.texts.titleMedium,
              ),
              Text(
                '${positive ? '+' : ''}${formatQuantity(line.variance)}',
                style: context.texts.bodySmall?.copyWith(
                  color: line.variance == 0
                      ? context.colors.onSurfaceVariant
                      : positive
                      ? NexoraColors.success
                      : NexoraColors.danger,
                ),
                textDirection: TextDirection.ltr,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CountLineDialog extends StatefulWidget {
  const _CountLineDialog({required this.product});

  final Product product;

  @override
  State<_CountLineDialog> createState() => _CountLineDialogState();
}

class _CountLineDialogState extends State<_CountLineDialog> {
  final _quantity = TextEditingController();
  String _mode = 'set';
  String? _error;

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  void _submit() {
    final raw = _quantity.text.trim().replaceAll(',', '.');
    if (!RegExp(r'^\d+(\.\d{1,4})?$').hasMatch(raw)) {
      setState(() => _error = context.l10n.commonInvalidNumber);
      return;
    }
    final quantity = double.tryParse(raw);
    if (quantity == null || (_mode == 'increment' && quantity <= 0)) {
      setState(() => _error = context.l10n.commonInvalidNumber);
      return;
    }
    Navigator.of(context).pop((quantity: quantity, mode: _mode));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(widget.product.name),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'set', label: Text(l10n.stockSetCount)),
              ButtonSegment(
                value: 'increment',
                label: Text(l10n.stockIncrement),
              ),
            ],
            selected: {_mode},
            onSelectionChanged: (selection) =>
                setState(() => _mode = selection.single),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _quantity,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(labelText: l10n.commonQuantity),
          ),
          if (_error != null) ...[
            const SizedBox(height: NexoraSpace.sm),
            Text(_error!, style: TextStyle(color: context.colors.error)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(onPressed: _submit, child: Text(l10n.commonSave)),
      ],
    );
  }
}
