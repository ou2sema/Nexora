import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/auth/permissions.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/account.dart';

Future<void> showOrganizationSwitcher(
  BuildContext context,
  WidgetRef ref,
) async {
  final current = ref.read(sessionProvider).organizationId;
  final memberships = ref.read(sessionProvider).memberships;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.75,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Text(
              sheetContext.l10n.orgSwitch,
              style: sheetContext.texts.titleLarge,
            ),
            const SizedBox(height: NexoraSpace.md),
            ...memberships.map(
              (membership) => Padding(
                padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                child: _MembershipRow(
                  membership: membership,
                  selected: membership.organizationId == current,
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    ref
                        .read(sessionProvider.notifier)
                        .selectOrganization(membership.organizationId);
                  },
                ),
              ),
            ),
            const SizedBox(height: NexoraSpace.sm),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                context.push('/organizations/new');
              },
              icon: const Icon(Icons.add_business_outlined),
              label: Text(sheetContext.l10n.adminNewOrganization),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MembershipRow extends StatelessWidget {
  const _MembershipRow({
    required this.membership,
    required this.selected,
    required this.onTap,
  });

  final Membership membership;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => NexoraCard(
    onTap: onTap,
    color: selected ? context.colors.primaryContainer : null,
    child: Row(
      children: [
        CircleAvatar(
          radius: 20,
          backgroundColor: context.colors.primary,
          foregroundColor: context.colors.onPrimary,
          child: Text(
            membership.organizationName.characters.first.toUpperCase(),
            style: context.texts.titleMedium?.copyWith(
              color: context.colors.onPrimary,
            ),
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
              Text(membership.organizationSlug, style: context.texts.bodySmall),
            ],
          ),
        ),
        StatusPill(
          label: roleLabel(context.l10n, membership.role),
          tone: membership.role == MemberRole.owner
              ? PillTone.primary
              : PillTone.neutral,
        ),
        if (selected) ...[
          const SizedBox(width: NexoraSpace.sm),
          Icon(
            Icons.check_circle_rounded,
            color: context.colors.primary,
            size: 20,
          ),
        ],
      ],
    ),
  );
}
