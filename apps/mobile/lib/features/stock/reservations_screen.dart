import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/stock.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';

String reservationStatusLabel(AppLocalizations l10n, String status) =>
    switch (status) {
      'active' => l10n.stockReservationActive,
      'released' => l10n.stockReservationReleasedStatus,
      'fulfilled' => l10n.stockReservationFulfilled,
      _ => l10n.stockReservationExpiredStatus,
    };

PillTone reservationStatusTone(String status) => switch (status) {
  'active' => PillTone.primary,
  'fulfilled' => PillTone.success,
  'released' => PillTone.neutral,
  _ => PillTone.warning,
};

class ReservationsScreen extends ConsumerStatefulWidget {
  const ReservationsScreen({super.key});

  @override
  ConsumerState<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends ConsumerState<ReservationsScreen> {
  String? _releasing;

  Future<void> _release(StockReservation reservation) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.stockRelease),
        content: Text(
          '${reservation.productName} · ${formatQuantity(reservation.quantity)}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.stockRelease),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _releasing = reservation.id);
    try {
      await IdempotencyGuard().run(
        (key) => ref
            .read(nexoraApiProvider)
            .releaseReservation(
              organizationId,
              reservation.id,
              idempotencyKey: key,
            ),
      );
      ref.invalidate(reservationsProvider);
      ref.invalidate(stockLevelsProvider);
      ref.invalidate(stockSummaryProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.stockReservationReleased)));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(l10n, failureOf(error)))),
        );
      }
    } finally {
      if (mounted) setState(() => _releasing = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final reservations = ref.watch(reservationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.stockReservations),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.stockReserve,
              onPressed: () => context.push('/stock/reservations/new'),
              icon: const Icon(Icons.add_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(reservationsProvider.future),
        child: AsyncPane(
          value: reservations,
          onRetry: () => ref.invalidate(reservationsProvider),
          builder: (page) => page.items.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    const SizedBox(height: 48),
                    EmptyState(
                      icon: Icons.lock_clock_outlined,
                      title: l10n.stockNoReservations,
                      actionLabel: role.canWrite ? l10n.stockReserve : null,
                      onAction: role.canWrite
                          ? () => context.push('/stock/reservations/new')
                          : null,
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    for (final reservation in page.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                        child: NexoraCard(
                          padding: const EdgeInsets.all(NexoraSpace.md),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      reservation.productName,
                                      style: context.texts.titleSmall,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  StatusPill(
                                    label: reservationStatusLabel(
                                      l10n,
                                      reservation.status,
                                    ),
                                    tone: reservationStatusTone(
                                      reservation.status,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: NexoraSpace.xs),
                              Text(
                                '${reservation.productSku} · '
                                '${reservation.warehouseCode}/${reservation.locationCode}',
                                style: context.texts.bodySmall,
                                textDirection: TextDirection.ltr,
                              ),
                              const SizedBox(height: NexoraSpace.sm),
                              Row(
                                children: [
                                  QuantityText(
                                    reservation.quantity,
                                    style: context.texts.titleMedium,
                                  ),
                                  const Spacer(),
                                  if (reservation.expiresAt != null)
                                    Text(
                                      '${l10n.stockExpires} ${formatDate(reservation.expiresAt)}',
                                      style: context.texts.bodySmall,
                                    ),
                                ],
                              ),
                              if (reservation.note != null) ...[
                                const SizedBox(height: NexoraSpace.xs),
                                Text(
                                  reservation.note!,
                                  style: context.texts.bodySmall,
                                ),
                              ],
                              if (reservation.status == 'active' &&
                                  role.canWrite) ...[
                                const SizedBox(height: NexoraSpace.sm),
                                Align(
                                  alignment: AlignmentDirectional.centerEnd,
                                  child: OutlinedButton.icon(
                                    onPressed: _releasing == null
                                        ? () => _release(reservation)
                                        : null,
                                    icon: _releasing == reservation.id
                                        ? const SizedBox.square(
                                            dimension: 16,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Icon(Icons.lock_open_rounded),
                                    label: Text(l10n.stockRelease),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}
