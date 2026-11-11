import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/scanning.dart';
import '../../data/providers.dart';

class StockCountsScreen extends ConsumerStatefulWidget {
  const StockCountsScreen({super.key});

  @override
  ConsumerState<StockCountsScreen> createState() => _StockCountsScreenState();
}

class _StockCountsScreenState extends ConsumerState<StockCountsScreen> {
  StockCountStatus? _status;
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final query = (status: _status?.name, page: _page);
    final counts = ref.watch(stockCountsProvider(query));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.stockCountsTitle),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.stockNewCount,
              onPressed: () => context.push('/stock/counts/new'),
              icon: const Icon(Icons.add_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              children: [
                _StatusChip(
                  label: l10n.commonAll,
                  selected: _status == null,
                  onTap: () => setState(() {
                    _status = null;
                    _page = 1;
                  }),
                ),
                for (final status in StockCountStatus.values)
                  _StatusChip(
                    label: stockCountStatusLabel(l10n, status),
                    selected: _status == status,
                    onTap: () => setState(() {
                      _status = status;
                      _page = 1;
                    }),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(stockCountsProvider(query).future),
              child: counts.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.assignment_outlined,
                            title: l10n.stockCountEmpty,
                            actionLabel: role.canWrite
                                ? l10n.stockNewCount
                                : null,
                            onAction: role.canWrite
                                ? () => context.push('/stock/counts/new')
                                : null,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final count in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: NexoraCard(
                                onTap: () =>
                                    context.push('/stock/counts/${count.id}'),
                                padding: const EdgeInsets.all(NexoraSpace.md),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${count.warehouseCode}/${count.locationCode}',
                                            style: context.texts.titleSmall,
                                            textDirection: TextDirection.ltr,
                                          ),
                                          Text(
                                            '${formatDateTime(count.createdAt)} · '
                                            '${l10n.ordersLines(count.lineCount)}',
                                            style: context.texts.bodySmall,
                                          ),
                                          if (count.note != null)
                                            Text(
                                              count.note!,
                                              style: context.texts.bodySmall,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                        ],
                                      ),
                                    ),
                                    StatusPill(
                                      label: stockCountStatusLabel(
                                        l10n,
                                        count.status,
                                      ),
                                      tone: stockCountStatusTone(count.status),
                                    ),
                                  ],
                                ),
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
                  onRetry: () => ref.invalidate(stockCountsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    ),
  );
}
