import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/drafts.dart';
import '../../data/models/invoicing.dart';
import '../../data/providers.dart';

class CustomerFormScreen extends ConsumerStatefulWidget {
  const CustomerFormScreen({super.key, this.initial});

  final Customer? initial;

  @override
  ConsumerState<CustomerFormScreen> createState() => _CustomerFormScreenState();
}

class _CustomerFormScreenState extends ConsumerState<CustomerFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late final TextEditingController _address;
  late final TextEditingController _city;
  late final TextEditingController _country;
  late final TextEditingController _taxId;
  bool _busy = false;

  Customer? get _customer => widget.initial;

  @override
  void initState() {
    super.initState();
    final customer = _customer;
    _name = TextEditingController(text: customer?.name ?? '');
    _email = TextEditingController(text: customer?.email ?? '');
    _phone = TextEditingController(text: customer?.phone ?? '');
    _address = TextEditingController(text: customer?.addressLine ?? '');
    _city = TextEditingController(text: customer?.city ?? '');
    _country = TextEditingController(text: customer?.countryCode ?? '');
    _taxId = TextEditingController(text: customer?.taxId ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _address.dispose();
    _city.dispose();
    _country.dispose();
    _taxId.dispose();
    super.dispose();
  }

  String? _blank(String value) => value.trim().isEmpty ? null : value.trim();

  Future<void> _save() async {
    final l10n = context.l10n;
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    final api = ref.read(nexoraApiProvider);
    final draft = CustomerDraft(
      name: _name.text.trim(),
      email: _blank(_email.text),
      phone: _blank(_phone.text),
      addressLine: _blank(_address.text),
      city: _blank(_city.text),
      countryCode: _blank(_country.text)?.toUpperCase(),
      taxId: _blank(_taxId.text),
    );
    setState(() => _busy = true);
    try {
      final existing = _customer;
      if (existing == null) {
        await api.createCustomer(organizationId, draft);
      } else {
        await api.updateCustomer(organizationId, existing.id, draft.toJson());
      }
      ref.invalidate(customersProvider);
      ref.invalidate(customerOptionsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.customersSaved)));
      Navigator.of(context).pop();
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

  Future<void> _toggleActive() async {
    final l10n = context.l10n;
    final customer = _customer;
    final organizationId = ref.read(organizationIdProvider);
    if (customer == null || organizationId == null) return;
    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(nexoraApiProvider)
          .setCustomerActive(
            organizationId,
            customer.id,
            isActive: !customer.isActive,
          );
      ref.invalidate(customersProvider);
      ref.invalidate(customerOptionsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.customersSaved)));
      Navigator.of(context).pop(updated);
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
    final editing = _customer != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? l10n.commonEdit : l10n.customersNew),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              TextFormField(
                controller: _name,
                autofocus: !editing,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.commonName),
                validator: (value) =>
                    (value ?? '').trim().isEmpty ? l10n.commonRequired : null,
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  labelText: l10n.commonEmail,
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
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  labelText: l10n.customersPhone,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _address,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: l10n.customersAddress,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.md),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _city,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: l10n.customersCity,
                        helperText: l10n.commonOptional,
                      ),
                    ),
                  ),
                  const SizedBox(width: NexoraSpace.md),
                  SizedBox(
                    width: 96,
                    child: TextFormField(
                      controller: _country,
                      textCapitalization: TextCapitalization.characters,
                      textDirection: TextDirection.ltr,
                      maxLength: 2,
                      decoration: InputDecoration(
                        labelText: l10n.suppliersCountry,
                        counterText: '',
                      ),
                      validator: (value) {
                        final code = (value ?? '').trim();
                        if (code.isEmpty) return null;
                        return RegExp(r'^[A-Za-z]{2}$').hasMatch(code)
                            ? null
                            : l10n.errorValidation;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NexoraSpace.md),
              TextFormField(
                controller: _taxId,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(
                  labelText: l10n.customersTaxId,
                  helperText: l10n.commonOptional,
                ),
              ),
              const SizedBox(height: NexoraSpace.xl),
              FilledButton(
                onPressed: _busy ? null : _save,
                child: _busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.commonSave),
              ),
              if (editing) ...[
                const SizedBox(height: NexoraSpace.md),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _toggleActive,
                  icon: Icon(
                    _customer!.isActive
                        ? Icons.pause_circle_outline_rounded
                        : Icons.play_circle_outline_rounded,
                  ),
                  label: Text(
                    _customer!.isActive
                        ? l10n.customersDeactivate
                        : l10n.customersActivate,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
