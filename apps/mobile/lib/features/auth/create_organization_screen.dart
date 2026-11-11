import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/auth/permissions.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';

class CreateOrganizationScreen extends ConsumerStatefulWidget {
  const CreateOrganizationScreen({super.key});

  @override
  ConsumerState<CreateOrganizationScreen> createState() =>
      _CreateOrganizationScreenState();
}

class _CreateOrganizationScreenState
    extends ConsumerState<CreateOrganizationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _slug = TextEditingController();
  final _email = TextEditingController();
  MemberRole _role = MemberRole.manager;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _slug.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final created = await ref
          .read(nexoraApiProvider)
          .createOrganization(
            name: _name.text.trim(),
            slug: _slug.text.trim().isEmpty ? null : _slug.text.trim(),
            firstMemberEmail: _email.text.trim().isEmpty
                ? null
                : _email.text.trim(),
            firstMemberRole: _role.name,
          );
      if (!mounted) return;
      await ref
          .read(sessionProvider.notifier)
          .refreshWorkspace(selectOrganizationId: created.id);
      if (mounted && context.canPop()) {
        context.pop();
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = failureText(context.l10n, failureOf(error)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.adminNewOrganizationTitle)),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(NexoraSpace.xl),
            children: [
              Text(l10n.orgChooseSubtitle, style: context.texts.bodyMedium),
              const SizedBox(height: NexoraSpace.xl),
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: context.colors.error)),
                const SizedBox(height: NexoraSpace.md),
              ],
              TextFormField(
                controller: _name,
                autofocus: true,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.adminOrgName),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _slug,
                textInputAction: TextInputAction.next,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  labelText: l10n.adminOrgSlug,
                  helperText: l10n.commonOptional,
                ),
                validator: (value) {
                  final slug = (value ?? '').trim();
                  if (slug.isEmpty) return null;
                  return RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$').hasMatch(slug)
                      ? null
                      : l10n.errorValidation;
                },
              ),
              const SizedBox(height: NexoraSpace.xl),
              Text(l10n.teamInviteTitle, style: context.texts.titleMedium),
              const SizedBox(height: NexoraSpace.sm),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: l10n.adminFirstMemberEmail,
                  helperText: l10n.commonOptional,
                ),
                validator: (value) {
                  final email = (value ?? '').trim();
                  if (email.isEmpty) return null;
                  return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)
                      ? null
                      : l10n.authInvalidEmail;
                },
              ),
              const SizedBox(height: NexoraSpace.md),
              DropdownButtonFormField<MemberRole>(
                initialValue: _role,
                decoration: InputDecoration(
                  labelText: l10n.adminFirstMemberRole,
                ),
                items: [MemberRole.admin, MemberRole.manager, MemberRole.viewer]
                    .map(
                      (role) => DropdownMenuItem(
                        value: role,
                        child: Text(roleLabel(l10n, role)),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) =>
                    setState(() => _role = value ?? MemberRole.manager),
              ),
              const SizedBox(height: NexoraSpace.xl),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.adminCreateOrg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
