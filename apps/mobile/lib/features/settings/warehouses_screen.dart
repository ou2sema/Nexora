import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/providers.dart';

class WarehousesScreen extends ConsumerStatefulWidget {
  const WarehousesScreen({super.key});

  @override
  ConsumerState<WarehousesScreen> createState() => _WarehousesScreenState();
}

class _WarehousesScreenState extends ConsumerState<WarehousesScreen> {
  bool _busy = false;

  Future<void> _newWarehouse() async {
    final l10n = context.l10n;
    final result = await showDialog<({String code, String name, String? city})>(
      context: context,
      builder: (_) => const _WarehouseDialog(),
    );
    if (result == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(nexoraApiProvider).createWarehouse(organizationId, {
        'code': result.code,
        'name': result.name,
        'city': result.city,
      });
      ref.invalidate(warehousesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.warehousesSaved)));
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

  Future<void> _newLocation(Warehouse warehouse) async {
    final l10n = context.l10n;
    final result = await showDialog<({String code, String name})>(
      context: context,
      builder: (_) => _LocationDialog(warehouse: warehouse),
    );
    if (result == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(nexoraApiProvider)
          .createLocation(
            organizationId,
            warehouse.id,
            code: result.code,
            name: result.name,
          );
      ref.invalidate(warehousesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.warehousesSaved)));
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
    final warehouses = ref.watch(warehousesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.moreWarehouses),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.warehousesNew,
              onPressed: _busy ? null : _newWarehouse,
              icon: const Icon(Icons.add_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(warehousesProvider.future),
        child: AsyncPane(
          value: warehouses,
          onRetry: () => ref.invalidate(warehousesProvider),
          builder: (items) {
            if (items.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const SizedBox(height: 48),
                  EmptyState(
                    icon: Icons.warehouse_outlined,
                    title: l10n.commonEmpty,
                    actionLabel: role.canWrite ? l10n.warehousesNew : null,
                    onAction: role.canWrite ? _newWarehouse : null,
                  ),
                ],
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                for (final warehouse in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.md),
                    child: NexoraCard(
                      padding: EdgeInsets.zero,
                      child: ExpansionTile(
                        leading: const Icon(Icons.warehouse_outlined),
                        title: Text('${warehouse.code} · ${warehouse.name}'),
                        subtitle: warehouse.city == null
                            ? null
                            : Text(warehouse.city!),
                        children: [
                          for (final location in warehouse.locations)
                            ListTile(
                              dense: true,
                              contentPadding: const EdgeInsetsDirectional.only(
                                start: 28,
                                end: 16,
                              ),
                              leading: const Icon(Icons.shelves),
                              title: Text(location.display),
                              trailing: location.isActive
                                  ? null
                                  : StatusPill(
                                      label: l10n.suppliersInactive,
                                      tone: PillTone.neutral,
                                    ),
                            ),
                          if (role.canWrite)
                            ListTile(
                              leading: const Icon(Icons.add_rounded),
                              title: Text(l10n.warehousesAddLocation),
                              onTap: _busy
                                  ? null
                                  : () => _newLocation(warehouse),
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _WarehouseDialog extends StatefulWidget {
  const _WarehouseDialog();

  @override
  State<_WarehouseDialog> createState() => _WarehouseDialogState();
}

class _WarehouseDialogState extends State<_WarehouseDialog> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _city = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _city.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.warehousesNew),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _code,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: l10n.warehousesCode),
              validator: (value) {
                final code = (value ?? '').trim();
                return RegExp(r'^[A-Za-z0-9-]{2,16}$').hasMatch(code)
                    ? null
                    : l10n.errorValidation;
              },
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(labelText: l10n.commonName),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _city,
              decoration: InputDecoration(
                labelText: l10n.warehousesCity,
                helperText: l10n.commonOptional,
              ),
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
            Navigator.of(context).pop((
              code: _code.text.trim().toUpperCase(),
              name: _name.text.trim(),
              city: _city.text.trim().isEmpty ? null : _city.text.trim(),
            ));
          },
          child: Text(l10n.commonCreate),
        ),
      ],
    );
  }
}

class _LocationDialog extends StatefulWidget {
  const _LocationDialog({required this.warehouse});

  final Warehouse warehouse;

  @override
  State<_LocationDialog> createState() => _LocationDialogState();
}

class _LocationDialogState extends State<_LocationDialog> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _name = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.warehousesAddLocation),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                '${widget.warehouse.code} · ${widget.warehouse.name}',
                style: context.texts.bodyMedium,
              ),
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _code,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                labelText: l10n.warehousesLocationCode,
              ),
              validator: (value) {
                final code = (value ?? '').trim();
                return RegExp(r'^[A-Za-z0-9-]{1,24}$').hasMatch(code)
                    ? null
                    : l10n.errorValidation;
              },
            ),
            const SizedBox(height: NexoraSpace.md),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(
                labelText: l10n.warehousesLocationName,
              ),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
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
            Navigator.of(context).pop((
              code: _code.text.trim().toUpperCase(),
              name: _name.text.trim(),
            ));
          },
          child: Text(l10n.commonCreate),
        ),
      ],
    );
  }
}
