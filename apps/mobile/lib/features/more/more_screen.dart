import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/auth/permissions.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../features/shell/organization_switcher.dart';

class MoreScreen extends ConsumerStatefulWidget {
  const MoreScreen({super.key});

  @override
  ConsumerState<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends ConsumerState<MoreScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = ref.watch(sessionProvider);
    final role = session.role;
    final membership = session.membership;

    final operations = <_MoreEntry>[
      _MoreEntry(
        l10n.moreStockLevels,
        Icons.inventory_2_outlined,
        '/stock/levels',
      ),
      _MoreEntry(
        l10n.moreMovements,
        Icons.swap_vert_rounded,
        '/stock/movements',
      ),
      _MoreEntry(
        l10n.moreTransfers,
        Icons.swap_horiz_rounded,
        '/stock/transfer',
      ),
      _MoreEntry(
        l10n.moreReservations,
        Icons.lock_clock_outlined,
        '/stock/reservations',
      ),
      _MoreEntry(
        l10n.moreReconciliation,
        Icons.rule_folder_outlined,
        '/stock/reconciliation',
      ),
      _MoreEntry(
        l10n.moreStockCounts,
        Icons.fact_check_outlined,
        '/stock/counts',
      ),
      _MoreEntry(l10n.moreDevices, Icons.smartphone_outlined, '/devices'),
      _MoreEntry(
        l10n.morePurchaseOrders,
        Icons.local_shipping_outlined,
        '/orders/purchases',
      ),
      _MoreEntry(
        l10n.moreSalesOrders,
        Icons.receipt_long_outlined,
        '/orders/sales',
      ),
      _MoreEntry(l10n.moreInvoices, Icons.description_outlined, '/invoices'),
      _MoreEntry(
        l10n.moreSuppliers,
        Icons.local_shipping_outlined,
        '/suppliers',
      ),
      _MoreEntry(
        l10n.moreCustomers,
        Icons.people_outline_rounded,
        '/customers',
      ),
      _MoreEntry(l10n.moreReports, Icons.insights_outlined, '/reports'),
    ];

    final organization = <_MoreEntry>[
      _MoreEntry(l10n.moreBranding, Icons.palette_outlined, '/branding'),
      _MoreEntry(l10n.moreTeam, Icons.group_outlined, '/team'),
      _MoreEntry(
        l10n.moreWarehouses,
        Icons.warehouse_outlined,
        '/settings/warehouses',
      ),
      _MoreEntry(
        l10n.moreCatalogSettings,
        Icons.category_outlined,
        '/settings/catalog',
      ),
      if (session.platformAdmin)
        _MoreEntry(l10n.moreAdmin, Icons.shield_outlined, '/admin'),
    ];

    final account = <_MoreEntry>[
      _MoreEntry(
        l10n.orgSwitch,
        Icons.business_outlined,
        null,
        onTap: () => showOrganizationSwitcher(context, ref),
      ),
      _MoreEntry(
        l10n.moreLanguage,
        Icons.translate_rounded,
        null,
        onTap: _pickLanguage,
      ),
      // Pointing the device at another server changes where tokens are sent,
      // so it stays with the people who administer this organization.
      if (role.canManageTeam || session.platformAdmin)
        _MoreEntry(l10n.moreConnection, Icons.dns_outlined, '/connection'),
      _MoreEntry(
        l10n.commonSignOut,
        Icons.logout_rounded,
        null,
        onTap: () => ref.read(sessionProvider.notifier).signOut(),
      ),
    ];

    final query = _query.trim().toLowerCase();
    bool matches(_MoreEntry entry) =>
        query.isEmpty || entry.label.toLowerCase().contains(query);

    final filtered = [
      ...operations.where(matches),
      ...organization.where(matches),
      ...account.where(matches),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.moreTitle)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: SearchField(
              hint: l10n.commonSearchWorkflows,
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              children: [
                if (query.isEmpty) ...[
                  NexoraCard(
                    onTap: () => showOrganizationSwitcher(context, ref),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: context.colors.primaryContainer,
                          foregroundColor: context.colors.onPrimaryContainer,
                          child: Text(
                            (membership?.organizationName ?? '?')
                                .characters
                                .first
                                .toUpperCase(),
                          ),
                        ),
                        const SizedBox(width: NexoraSpace.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                membership?.organizationName ??
                                    l10n.commonOrganization,
                                style: context.texts.titleMedium,
                              ),
                              Text(
                                session.email ?? '',
                                style: context.texts.bodySmall,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textDirection: TextDirection.ltr,
                              ),
                            ],
                          ),
                        ),
                        StatusPill(
                          label: roleLabel(l10n, role),
                          tone: role == MemberRole.owner
                              ? PillTone.primary
                              : PillTone.neutral,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: NexoraSpace.lg),
                  SectionHeader(title: l10n.moreOperations),
                  _EntryGroup(entries: operations.where(matches).toList()),
                  const SizedBox(height: NexoraSpace.lg),
                  SectionHeader(title: l10n.moreOrganization),
                  _EntryGroup(entries: organization.where(matches).toList()),
                  const SizedBox(height: NexoraSpace.lg),
                  SectionHeader(title: l10n.moreAccount),
                  _EntryGroup(entries: account.where(matches).toList()),
                ] else if (filtered.isEmpty)
                  EmptyState(
                    icon: Icons.search_off_rounded,
                    title: l10n.moreNoResults,
                  )
                else
                  _EntryGroup(entries: filtered),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickLanguage() async {
    final l10n = context.l10n;
    final choice = await showModalBottomSheet<Locale>(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.7,
          ),
          child: ListView(
            shrinkWrap: true,
            children: [
              Padding(
                padding: const EdgeInsets.all(NexoraSpace.lg),
                child: Text(
                  l10n.commonLanguage,
                  style: context.texts.titleMedium,
                ),
              ),
              _languageTile(context, label: l10n.languageSystem, locale: null),
              _languageTile(
                context,
                label: l10n.languageEnglish,
                locale: const Locale('en'),
              ),
              _languageTile(
                context,
                label: l10n.languageFrench,
                locale: const Locale('fr'),
              ),
              _languageTile(
                context,
                label: l10n.languageArabic,
                locale: const Locale('ar'),
              ),
            ],
          ),
        ),
      ),
    );
    if (choice == null) return;
    await ref
        .read(preferencesProvider.notifier)
        .setLocale(choice == _systemLocale ? null : choice);
  }

  Widget _languageTile(
    BuildContext context, {
    required String label,
    required Locale? locale,
  }) {
    final current = ref.read(preferencesProvider).locale;
    final selected = locale == null
        ? current == null
        : current?.languageCode == locale.languageCode;
    return ListTile(
      leading: Icon(
        selected ? Icons.check_circle_rounded : Icons.circle_outlined,
      ),
      title: Text(label),
      onTap: () => Navigator.of(context).pop(locale ?? _systemLocale),
    );
  }
}

/// The sheet returns null when dismissed, so an explicit sentinel marks the
/// "system default" choice.
const Locale _systemLocale = Locale('__system__');

class _MoreEntry {
  _MoreEntry(this.label, this.icon, this.route, {this.onTap});

  final String label;
  final IconData icon;
  final String? route;
  final VoidCallback? onTap;
}

class _EntryGroup extends StatelessWidget {
  const _EntryGroup({required this.entries});

  final List<_MoreEntry> entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) return const SizedBox.shrink();
    return NexoraCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var index = 0; index < entries.length; index++) ...[
            if (index > 0) const Divider(height: 1),
            ListTile(
              leading: Icon(entries[index].icon),
              title: Text(entries[index].label),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () {
                final entry = entries[index];
                if (entry.onTap != null) {
                  entry.onTap!();
                } else if (entry.route != null) {
                  context.push(entry.route!);
                }
              },
            ),
          ],
        ],
      ),
    );
  }
}
