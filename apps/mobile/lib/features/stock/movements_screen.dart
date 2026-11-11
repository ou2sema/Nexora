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
import '../../data/models/stock.dart';
import '../../data/providers.dart';

class StockMovementsScreen extends ConsumerStatefulWidget {
  const StockMovementsScreen({super.key});

  @override
  ConsumerState<StockMovementsScreen> createState() =>
      _StockMovementsScreenState();
}

class _StockMovementsScreenState extends ConsumerState<StockMovementsScreen> {
  StockMovementType? _type;
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final query = (
      page: _page,
      productId: null,
      warehouseId: null,
      type: _type?.name,
    );
    final movements = ref.watch(movementsProvider(query));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.stockMovements),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.stockPostMovement,
              onPressed: () => context.push('/stock/movements/new'),
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
                _TypeChip(
                  label: l10n.commonAll,
                  selected: _type == null,
                  onTap: () => setState(() {
                    _type = null;
                    _page = 1;
                  }),
                ),
                for (final type in const [
                  StockMovementType.receipt,
                  StockMovementType.issue,
                  StockMovementType.adjustment,
                ])
                  _TypeChip(
                    label: movementTypeLabel(l10n, type),
                    selected: _type == type,
                    onTap: () => setState(() {
                      _type = type;
                      _page = 1;
                    }),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(movementsProvider(query).future),
              child: movements.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: l10n.stockNoMovements,
                            actionLabel: role.canWrite
                                ? l10n.stockPostMovement
                                : null,
                            onAction: role.canWrite
                                ? () => context.push('/stock/movements/new')
                                : null,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final movement in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _MovementRow(
                                movement: movement,
                                onTap: () => context.push(
                                  '/products/${movement.productId}',
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
                  onRetry: () => ref.invalidate(movementsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
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

class _MovementRow extends StatelessWidget {
  const _MovementRow({required this.movement, required this.onTap});

  final StockMovement movement;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final positive = movement.quantityDelta >= 0;
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
                  movement.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${movement.warehouseCode}/${movement.locationCode} · '
                  '${formatDateTime(movement.createdAt)}',
                  style: context.texts.bodySmall,
                  textDirection: TextDirection.ltr,
                ),
                if (movement.reason != null)
                  Text(
                    movement.reason!,
                    style: context.texts.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const SizedBox(width: NexoraSpace.sm),
          StatusPill(
            label: movementTypeLabel(l10n, movement.type),
            tone: movementTypeTone(movement.type),
          ),
          const SizedBox(width: NexoraSpace.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${positive ? '+' : ''}${formatQuantity(movement.quantityDelta)}',
                style: context.texts.titleSmall?.copyWith(
                  color: positive ? NexoraColors.success : NexoraColors.danger,
                ),
                textDirection: TextDirection.ltr,
              ),
              Text(
                '${l10n.inventoryOnHandShort} ${formatQuantity(movement.onHandAfter)}',
                style: context.texts.bodySmall,
                textDirection: TextDirection.ltr,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
