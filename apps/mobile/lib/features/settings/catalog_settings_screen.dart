import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/providers.dart';

class CatalogSettingsScreen extends ConsumerStatefulWidget {
  const CatalogSettingsScreen({super.key});

  @override
  ConsumerState<CatalogSettingsScreen> createState() =>
      _CatalogSettingsScreenState();
}

class _CatalogSettingsScreenState extends ConsumerState<CatalogSettingsScreen> {
  bool _busy = false;

  Future<void> _create({required bool category}) async {
    final l10n = context.l10n;
    final name = await showDialog<String>(
      context: context,
      builder: (_) => _NameDialog(
        title: category ? l10n.catalogNewCategory : l10n.catalogNewBrand,
        label: category ? l10n.commonCategory : l10n.commonBrand,
      ),
    );
    if (name == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(nexoraApiProvider);
      if (category) {
        await api.createCategory(organizationId, name: name);
        ref.invalidate(categoriesProvider);
      } else {
        await api.createBrand(organizationId, name: name);
        ref.invalidate(brandsProvider);
      }
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.commonSuccess)));
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
    final role = ref.watch(activeRoleProvider);
    final categories = ref.watch(categoriesProvider);
    final brands = ref.watch(brandsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.moreCatalogSettings)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
          ref.invalidate(brandsProvider);
          await ref.read(categoriesProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            SectionHeader(
              title: l10n.commonCategory,
              actionLabel: role.canWrite ? l10n.catalogNewCategory : null,
              onAction: role.canWrite && !_busy
                  ? () => _create(category: true)
                  : null,
            ),
            AsyncPane(
              value: categories,
              onRetry: () => ref.invalidate(categoriesProvider),
              loading: const Padding(
                padding: EdgeInsets.all(NexoraSpace.md),
                child: Center(child: CircularProgressIndicator()),
              ),
              builder: (items) => items.isEmpty
                  ? Text(l10n.commonEmpty, style: context.texts.bodyMedium)
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final category in items)
                          Chip(label: Text(category.name)),
                      ],
                    ),
            ),
            const SizedBox(height: NexoraSpace.xl),
            SectionHeader(
              title: l10n.commonBrand,
              actionLabel: role.canWrite ? l10n.catalogNewBrand : null,
              onAction: role.canWrite && !_busy
                  ? () => _create(category: false)
                  : null,
            ),
            AsyncPane(
              value: brands,
              onRetry: () => ref.invalidate(brandsProvider),
              loading: const Padding(
                padding: EdgeInsets.all(NexoraSpace.md),
                child: Center(child: CircularProgressIndicator()),
              ),
              builder: (items) => items.isEmpty
                  ? Text(l10n.commonEmpty, style: context.texts.bodyMedium)
                  : Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final brand in items)
                          Chip(label: Text(brand.name)),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.title, required this.label});

  final String title;
  final String label;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(widget.title),
      content: Form(
        key: _formKey,
        child: TextFormField(
          controller: _name,
          autofocus: true,
          decoration: InputDecoration(labelText: widget.label),
          validator: (value) =>
              (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
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
            Navigator.of(context).pop(_name.text.trim());
          },
          child: Text(l10n.commonCreate),
        ),
      ],
    );
  }
}
