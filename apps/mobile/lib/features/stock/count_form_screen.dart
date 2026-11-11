import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/pickers.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/drafts.dart';
import '../../data/providers.dart';

class StockCountFormScreen extends ConsumerStatefulWidget {
  const StockCountFormScreen({super.key});

  @override
  ConsumerState<StockCountFormScreen> createState() =>
      _StockCountFormScreenState();
}

class _StockCountFormScreenState extends ConsumerState<StockCountFormScreen> {
  final _note = TextEditingController();
  ShelfChoice? _shelf;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickShelf() async {
    final shelf = await showShelfPicker(
      context,
      title: context.l10n.stockSelectCountLocation,
    );
    if (shelf != null) setState(() => _shelf = shelf);
  }

  Future<void> _start() async {
    final l10n = context.l10n;
    final shelf = _shelf;
    if (shelf == null) {
      setState(() => _error = l10n.stockSelectCountLocation);
      return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(nexoraApiProvider)
          .startStockCount(
            organizationId,
            StockCountStartDraft(
              warehouseId: shelf.warehouse.id,
              locationId: shelf.location.id,
              note: _note.text.trim().isEmpty ? null : _note.text.trim(),
            ),
          );
      ref.invalidate(stockCountsProvider);
      if (!mounted) return;
      context.pushReplacement('/stock/counts/${result.countId}');
    } on Object catch (error) {
      if (!mounted) return;
      final failure = failureOf(error);
      setState(
        () => _error = failure.code == 'stock_count_already_open'
            ? l10n.stockOpenCountExists
            : failureText(l10n, failure),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.stockNewCount)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text(l10n.stockSelectCountLocation, style: context.texts.bodyMedium),
          const SizedBox(height: NexoraSpace.md),
          ShelfField(
            label: l10n.stockSelectCountLocation,
            choice: _shelf,
            onTap: _pickShelf,
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _note,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(labelText: l10n.stockCountNote),
          ),
          if (_error != null) ...[
            const SizedBox(height: NexoraSpace.md),
            Text(_error!, style: TextStyle(color: context.colors.error)),
          ],
          const SizedBox(height: NexoraSpace.xl),
          FilledButton(
            onPressed: _busy ? null : _start,
            child: _busy
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.stockNewCount),
          ),
        ],
      ),
    );
  }
}
