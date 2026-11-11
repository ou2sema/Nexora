import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/auth/permissions.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/account.dart';

final pendingInvitationsProvider =
    FutureProvider.autoDispose<List<PendingInvitation>>(
      (ref) => ref.watch(nexoraApiProvider).pendingInvitations(),
    );

class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  String? _accepting;

  Future<void> _accept(PendingInvitation invitation) async {
    setState(() => _accepting = invitation.id);
    try {
      final membership = await ref
          .read(nexoraApiProvider)
          .acceptInvitation(invitation.id);
      ref.invalidate(pendingInvitationsProvider);
      await ref
          .read(sessionProvider.notifier)
          .refreshWorkspace(selectOrganizationId: membership.organizationId);
    } catch (error) {
      if (mounted) {
        final failure = failureOf(error);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(context.l10n, failure))),
        );
      }
    } finally {
      if (mounted) setState(() => _accepting = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final invitations = ref.watch(pendingInvitationsProvider);
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.orgChooseTitle),
        actions: [
          IconButton(
            tooltip: l10n.commonSignOut,
            onPressed: () => ref.read(sessionProvider.notifier).signOut(),
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.refresh(pendingInvitationsProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(NexoraSpace.xl),
            children: [
              Text(
                l10n.orgChooseSubtitle,
                style: context.texts.bodyMedium?.copyWith(
                  color: context.colors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: NexoraSpace.xl),
              if (session.memberships.isEmpty) ...[
                NexoraCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.storefront_outlined,
                            color: context.colors.primary,
                          ),
                          const SizedBox(width: NexoraSpace.sm),
                          Expanded(
                            child: Text(
                              l10n.orgNoMembershipsTitle,
                              style: context.texts.titleMedium,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      Text(
                        l10n.orgNoMembershipsBody,
                        style: context.texts.bodyMedium,
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      Text(
                        l10n.orgNoMembershipsNote,
                        style: context.texts.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: NexoraSpace.xl),
              ] else ...[
                SectionHeader(title: l10n.commonOrganization),
                ...session.memberships.map(
                  (membership) => Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.md),
                    child: _MembershipTile(
                      membership: membership,
                      onTap: () => ref
                          .read(sessionProvider.notifier)
                          .selectOrganization(membership.organizationId),
                    ),
                  ),
                ),
                const SizedBox(height: NexoraSpace.md),
              ],
              invitations.when(
                data: (items) {
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SectionHeader(title: l10n.orgPendingTitle(items.length)),
                      Text(l10n.orgPendingBody, style: context.texts.bodySmall),
                      const SizedBox(height: NexoraSpace.md),
                      ...items.map(
                        (invitation) => Padding(
                          padding: const EdgeInsets.only(
                            bottom: NexoraSpace.md,
                          ),
                          child: NexoraCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        invitation.organizationName,
                                        style: context.texts.titleMedium,
                                      ),
                                    ),
                                    StatusPill(
                                      label: roleLabel(
                                        context.l10n,
                                        invitation.role,
                                      ),
                                      tone: PillTone.primary,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: NexoraSpace.xs),
                                Text(
                                  l10n.orgExpires(
                                    _dateText(context, invitation.expiresAt),
                                  ),
                                  style: context.texts.bodySmall,
                                ),
                                const SizedBox(height: NexoraSpace.md),
                                FilledButton(
                                  onPressed: _accepting == null
                                      ? () => _accept(invitation)
                                      : null,
                                  child: _accepting == invitation.id
                                      ? const SizedBox.square(
                                          dimension: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Text(l10n.orgAccept),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
                loading: () => const Padding(
                  padding: EdgeInsets.all(NexoraSpace.lg),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  onRetry: () => ref.invalidate(pendingInvitationsProvider),
                  compact: true,
                ),
              ),
              const SizedBox(height: NexoraSpace.lg),
              OutlinedButton.icon(
                onPressed: () => context.push('/welcome/create'),
                icon: const Icon(Icons.add_business_outlined),
                label: Text(l10n.adminNewOrganization),
              ),
              if (session.platformAdmin) ...[
                const SizedBox(height: NexoraSpace.md),
                TextButton.icon(
                  onPressed: () => context.push('/admin'),
                  icon: const Icon(Icons.shield_outlined),
                  label: Text(l10n.commonPlatformAdmin),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MembershipTile extends StatelessWidget {
  const _MembershipTile({required this.membership, required this.onTap});

  final Membership membership;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => NexoraCard(
    onTap: onTap,
    child: Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: context.colors.primaryContainer,
          foregroundColor: context.colors.onPrimaryContainer,
          child: Text(
            membership.organizationName.characters.first.toUpperCase(),
            style: context.texts.titleLarge,
          ),
        ),
        const SizedBox(width: NexoraSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                membership.organizationName,
                style: context.texts.titleMedium,
              ),
              Text(
                membership.organizationSlug,
                style: context.texts.bodySmall,
                textDirection: TextDirection.ltr,
              ),
            ],
          ),
        ),
        StatusPill(
          label: roleLabel(context.l10n, membership.role),
          tone: membership.role == MemberRole.owner
              ? PillTone.primary
              : PillTone.neutral,
        ),
        const SizedBox(width: NexoraSpace.sm),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}

String _dateText(BuildContext context, DateTime? date) {
  if (date == null) return '—';
  return MaterialLocalizations.of(context).formatMediumDate(date.toLocal());
}
