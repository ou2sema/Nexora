import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/auth/permissions.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/team.dart';
import '../../data/providers.dart';

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  bool _busy = false;

  Future<void> _invite() async {
    final l10n = context.l10n;
    final role = ref.read(activeRoleProvider);
    final allowed = MemberRole.values
        .where(role.canInviteRole)
        .toList(growable: false);
    final result = await showDialog<({String email, MemberRole role})>(
      context: context,
      builder: (_) => _InviteDialog(allowedRoles: allowed),
    );
    if (result == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .createInvitation(
            organizationId,
            email: result.email,
            role: result.role.wire,
          );
      ref.invalidate(invitationsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.teamInviteCreated)));
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

  Future<void> _changeRole(TeamMember member) async {
    final l10n = context.l10n;
    final activeRole = ref.read(activeRoleProvider);
    final allowed = MemberRole.values
        .where(
          (role) =>
              role != member.role &&
              (role != MemberRole.owner || activeRole == MemberRole.owner),
        )
        .toList(growable: false);
    final chosen = await showModalBottomSheet<MemberRole>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(NexoraSpace.lg),
              child: Text(
                l10n.teamChangeRole,
                style: context.texts.titleMedium,
              ),
            ),
            for (final role in allowed)
              ListTile(
                leading: Icon(
                  role == member.role
                      ? Icons.check_rounded
                      : Icons.person_outline_rounded,
                ),
                title: Text(roleLabel(l10n, role)),
                onTap: () => Navigator.of(context).pop(role),
              ),
          ],
        ),
      ),
    );
    if (chosen == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .changeMemberRole(organizationId, member.userId, role: chosen.wire);
      ref.invalidate(teamMembersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.teamRoleChanged)));
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

  Future<void> _remove(TeamMember member) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.teamRemove),
        content: Text(l10n.teamRemoveConfirm(member.email ?? member.userId)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonRemove),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .removeMember(organizationId, member.userId);
      ref.invalidate(teamMembersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.teamMemberRemoved)));
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

  Future<void> _revoke(Invitation invitation) async {
    final l10n = context.l10n;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .revokeInvitation(organizationId, invitation.id);
      ref.invalidate(invitationsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.teamRevoked)));
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = ref.watch(sessionProvider);
    final role = session.role;
    final members = ref.watch(teamMembersProvider);
    final invitations = ref.watch(invitationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.teamTitle),
        actions: [
          if (role.canInvite)
            IconButton(
              tooltip: l10n.teamInvite,
              onPressed: _busy ? null : _invite,
              icon: const Icon(Icons.person_add_alt_1_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(teamMembersProvider);
          ref.invalidate(invitationsProvider);
          await ref.read(teamMembersProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          children: [
            SectionHeader(title: l10n.teamMembers),
            AsyncPane(
              value: members,
              onRetry: () => ref.invalidate(teamMembersProvider),
              loading: const Padding(
                padding: EdgeInsets.all(NexoraSpace.lg),
                child: Center(child: CircularProgressIndicator()),
              ),
              builder: (items) {
                if (items.isEmpty) {
                  return Text(
                    l10n.teamNoMembers,
                    style: context.texts.bodyMedium,
                  );
                }
                return Column(
                  children: [
                    for (final member in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                        child: _MemberRow(
                          member: member,
                          isSelf: member.userId == session.userId,
                          canManage: role.canManageTeam && !_busy,
                          onChangeRole:
                              role.canManageTeam &&
                                  !(member.userId == session.userId) &&
                                  (member.role != MemberRole.owner ||
                                      role == MemberRole.owner)
                              ? () => _changeRole(member)
                              : null,
                          onRemove:
                              role.canManageTeam &&
                                  member.userId != session.userId &&
                                  !_busy &&
                                  (member.role != MemberRole.owner ||
                                      role == MemberRole.owner)
                              ? () => _remove(member)
                              : null,
                        ),
                      ),
                  ],
                );
              },
            ),
            if (role.canInvite) ...[
              const SizedBox(height: NexoraSpace.lg),
              SectionHeader(
                title: l10n.teamInvitations,
                actionLabel: l10n.teamInvite,
                onAction: _busy ? null : _invite,
              ),
              AsyncPane(
                value: invitations,
                onRetry: () => ref.invalidate(invitationsProvider),
                loading: const Padding(
                  padding: EdgeInsets.all(NexoraSpace.lg),
                  child: Center(child: CircularProgressIndicator()),
                ),
                builder: (items) {
                  if (items.isEmpty) {
                    return Text(
                      l10n.commonEmpty,
                      style: context.texts.bodyMedium,
                    );
                  }
                  return Column(
                    children: [
                      for (final invitation in items)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: NexoraSpace.sm,
                          ),
                          child: _InvitationRow(
                            invitation: invitation,
                            onRevoke:
                                role.canManageTeam &&
                                    invitation.status ==
                                        InvitationStatus.pending &&
                                    !_busy
                                ? () => _revoke(invitation)
                                : null,
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    required this.isSelf,
    required this.canManage,
    this.onChangeRole,
    this.onRemove,
  });

  final TeamMember member;
  final bool isSelf;
  final bool canManage;
  final VoidCallback? onChangeRole;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: context.colors.primaryContainer,
            foregroundColor: context.colors.onPrimaryContainer,
            child: Text(_initial(member.email)),
          ),
          const SizedBox(width: NexoraSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member.email ?? member.userId,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (member.joinedAt != null)
                  Text(
                    formatDate(member.joinedAt),
                    style: context.texts.bodySmall,
                  ),
              ],
            ),
          ),
          StatusPill(
            label: roleLabel(l10n, member.role),
            tone: member.role == MemberRole.owner
                ? PillTone.primary
                : PillTone.neutral,
          ),
          if (canManage && (onChangeRole != null || onRemove != null))
            PopupMenuButton<String>(
              tooltip: l10n.commonActions,
              onSelected: (value) {
                if (value == 'role') onChangeRole?.call();
                if (value == 'remove') onRemove?.call();
              },
              itemBuilder: (context) => [
                if (onChangeRole != null)
                  PopupMenuItem(
                    value: 'role',
                    child: Text(l10n.teamChangeRole),
                  ),
                if (onRemove != null)
                  PopupMenuItem(value: 'remove', child: Text(l10n.teamRemove)),
              ],
            ),
        ],
      ),
    );
  }

  String _initial(String? email) {
    final value = email?.trim();
    if (value == null || value.isEmpty) return '?';
    return value.characters.first.toUpperCase();
  }
}

class _InvitationRow extends StatelessWidget {
  const _InvitationRow({required this.invitation, this.onRevoke});

  final Invitation invitation;
  final VoidCallback? onRevoke;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final status = switch (invitation.status) {
      InvitationStatus.pending => (l10n.teamPending, PillTone.warning),
      InvitationStatus.accepted => (l10n.teamAccepted, PillTone.success),
      InvitationStatus.expired => (l10n.teamExpired, PillTone.neutral),
      InvitationStatus.revoked => (l10n.teamRevoked, PillTone.danger),
    };
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  invitation.email,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              StatusPill(label: status.$1, tone: status.$2),
            ],
          ),
          const SizedBox(height: NexoraSpace.xs),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${roleLabel(l10n, invitation.role)} · '
                  '${l10n.stockExpires} ${formatDate(invitation.expiresAt)}',
                  style: context.texts.bodySmall,
                ),
              ),
              if (onRevoke != null)
                TextButton(onPressed: onRevoke, child: Text(l10n.teamRevoke)),
            ],
          ),
        ],
      ),
    );
  }
}

class _InviteDialog extends StatefulWidget {
  const _InviteDialog({required this.allowedRoles});

  final List<MemberRole> allowedRoles;

  @override
  State<_InviteDialog> createState() => _InviteDialogState();
}

class _InviteDialogState extends State<_InviteDialog> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  late MemberRole _role = widget.allowedRoles.isEmpty
      ? MemberRole.viewer
      : widget.allowedRoles.last;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.teamInviteTitle),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _email,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: l10n.commonEmail),
              validator: (value) {
                final email = (value ?? '').trim();
                if (email.isEmpty) return l10n.commonRequired;
                return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)
                    ? null
                    : l10n.authInvalidEmail;
              },
            ),
            const SizedBox(height: NexoraSpace.md),
            DropdownButtonFormField<MemberRole>(
              initialValue: _role,
              decoration: InputDecoration(labelText: l10n.teamRole),
              items: [
                for (final role in widget.allowedRoles)
                  DropdownMenuItem(
                    value: role,
                    child: Text(roleLabel(l10n, role)),
                  ),
              ],
              onChanged: (value) => setState(() => _role = value ?? _role),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          onPressed: () {
            if (!(_formKey.currentState?.validate() ?? false)) return;
            Navigator.of(context).pop((email: _email.text.trim(), role: _role));
          },
          child: Text(l10n.teamInvite),
        ),
      ],
    );
  }
}
