import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/admin.dart';
import '../../data/providers.dart';

class AdminScreen extends ConsumerWidget {
  const AdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final session = ref.watch(sessionProvider);
    if (!session.platformAdmin) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.adminTitle)),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: l10n.errorPermissionDenied,
          message: l10n.adminIdentityOnly,
        ),
      );
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.adminTitle),
          bottom: TabBar(
            tabs: [
              Tab(text: l10n.adminOrganizations),
              Tab(text: l10n.adminAudit),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => context.push('/admin/new-organization'),
          icon: const Icon(Icons.add_business_rounded),
          label: Text(l10n.adminNewOrganization),
        ),
        body: const TabBarView(children: [_OrganizationsTab(), _AuditTab()]),
      ),
    );
  }
}

class _OrganizationsTab extends ConsumerWidget {
  const _OrganizationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final organizations = ref.watch(adminOrganizationsProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(adminOrganizationsProvider.future),
      child: AsyncPane(
        value: organizations,
        onRetry: () => ref.invalidate(adminOrganizationsProvider),
        builder: (items) {
          if (items.isEmpty) {
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const SizedBox(height: 48),
                EmptyState(
                  icon: Icons.business_outlined,
                  title: l10n.adminNoOrgs,
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: NexoraSpace.sm),
            itemBuilder: (context, index) {
              final organization = items[index];
              return NexoraCard(
                padding: const EdgeInsets.all(NexoraSpace.md),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: context.colors.primaryContainer,
                      foregroundColor: context.colors.onPrimaryContainer,
                      child: Text(
                        organization.name.characters.first.toUpperCase(),
                      ),
                    ),
                    const SizedBox(width: NexoraSpace.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            organization.name,
                            style: context.texts.titleSmall,
                          ),
                          Text(
                            organization.slug,
                            style: context.texts.bodySmall,
                            textDirection: TextDirection.ltr,
                          ),
                          Text(
                            [
                              l10n.adminMembers(organization.memberCount),
                              if (organization.pendingInvitationCount > 0)
                                l10n.adminPendingInvites(
                                  organization.pendingInvitationCount,
                                ),
                              if (organization.createdAt != null)
                                formatDate(organization.createdAt),
                            ].join(' · '),
                            style: context.texts.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _AuditTab extends ConsumerWidget {
  const _AuditTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final events = ref.watch(adminAuditProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(adminAuditProvider.future),
      child: AsyncPane(
        value: events,
        onRetry: () => ref.invalidate(adminAuditProvider),
        builder: (items) {
          if (items.isEmpty) {
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const SizedBox(height: 48),
                EmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: l10n.adminNoAudit,
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: NexoraSpace.sm),
            itemBuilder: (context, index) => _AuditRow(event: items[index]),
          );
        },
      ),
    );
  }
}

class _AuditRow extends StatelessWidget {
  const _AuditRow({required this.event});

  final AdminAuditEvent event;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final detail = event.detail.entries
        .where((entry) => entry.value != null)
        .map((entry) => '${entry.key}: ${entry.value}')
        .join(' · ');
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(event.action, style: context.texts.titleSmall),
              ),
              Text(
                formatDateTime(event.createdAt),
                style: context.texts.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.xs),
          if (event.actorEmail != null)
            KeyValueRow(label: l10n.adminActor, value: event.actorEmail!),
          if (event.organizationName != null)
            KeyValueRow(
              label: l10n.commonOrganization,
              value: event.organizationName!,
            ),
          if (event.targetEmail != null)
            KeyValueRow(label: l10n.adminTarget, value: event.targetEmail!),
          if (detail.isNotEmpty)
            Text(
              detail,
              style: context.texts.bodySmall,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }
}
