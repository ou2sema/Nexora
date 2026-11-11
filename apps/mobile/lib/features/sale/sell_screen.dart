import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/catalog.dart';
import '../../data/models/invoicing.dart';
import '../../data/providers.dart';
import 'device_picker.dart';
import 'sale_controller.dart';

/// The counter. One basket is shared by this tab and the Scan tab, kept as a
/// draft per user and organization, and settled by a single idempotent invoice.
class SellScreen extends ConsumerStatefulWidget {
  const SellScreen({super.key});

  @override
  ConsumerState<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends ConsumerState<SellScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  void _snack(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  Future<void> _pickShelf() async {
    final selection =
        await showModalBottomSheet<
          ({Warehouse warehouse, StorageLocation location})
        >(
          context: context,
          isScrollControlled: true,
          builder: (_) => const _ShelfSheet(),
        );
    if (selection == null) return;
    ref
        .read(saleDraftProvider.notifier)
        .setShelf(
          warehouseId: selection.warehouse.id,
          warehouseName: selection.warehouse.code,
          locationId: selection.location.id,
          locationName: selection.location.code,
        );
  }

  Future<void> _add(Product product) async {
    final l10n = context.l10n;
    final controller = ref.read(saleDraftProvider.notifier);
    if (!ref.read(saleDraftProvider).hasShelf) {
      await _pickShelf();
      if (!mounted) return;
    }
    final draft = ref.read(saleDraftProvider);
    if (!draft.hasShelf) return;

    if (product.isSerialized) {
      final device = await showDevicePicker(context, ref, product);
      if (device == null || !mounted) return;
      final outcome = await controller.addDevice(device);
      if (!mounted) return;
      switch (outcome) {
        case DeviceAddResult.added:
          break;
        case DeviceAddResult.duplicate:
          _snack(l10n.saleDuplicateScan);
        case DeviceAddResult.wrongLocation:
          _snack(l10n.scanWrongLocation);
        case DeviceAddResult.notSellable:
          _snack(l10n.scanDeviceNotInStock(device.serialNumber));
      }
    } else {
      controller.addProduct(
        product,
        warehouseId: draft.warehouseId,
        locationId: draft.locationId,
      );
    }
    _search.clear();
    setState(() => _query = '');
  }

  Future<void> _editPrice(InvoiceLineDraft line) async {
    final minor = await _askAmount(
      context,
      title: context.l10n.salePriceOverride,
      initial: line.unitPriceMinor,
    );
    if (minor == null) return;
    ref.read(saleDraftProvider.notifier).updatePrice(line.referenceId, minor);
  }

  Future<void> _editTax(InvoiceLineDraft line) async {
    final percent = await _askPercent(context, initial: line.taxRatePercent);
    if (percent == null) return;
    ref
        .read(saleDraftProvider.notifier)
        .updateTaxRate(line.referenceId, percent);
  }

  void _review() {
    final l10n = context.l10n;
    final state = ref.read(saleDraftProvider);
    if (state.isEmpty) {
      _snack(l10n.saleNeedItems);
      return;
    }
    if (!state.hasShelf) {
      _snack(l10n.saleNeedShelf);
      return;
    }
    ref
        .read(saleDraftProvider.notifier)
        .startReview(walkInName: l10n.saleWalkIn);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(saleDraftProvider);
    return switch (state.step) {
      SaleStep.done when state.result != null => _DoneStep(state: state),
      SaleStep.review => _ReviewStep(state: state),
      _ => _buildBasket(context, state),
    };
  }

  Widget _buildBasket(BuildContext context, SaleDraftState state) {
    final l10n = context.l10n;
    final products = _query.isEmpty
        ? null
        : ref.watch(productOptionsProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.saleTitle, style: context.texts.titleLarge),
            Text(l10n.saleSubtitle, style: context.texts.bodySmall),
          ],
        ),
        actions: [
          IconButton(
            tooltip: l10n.scanTitle,
            onPressed: () => context.go('/scan'),
            icon: const Icon(Icons.qr_code_scanner_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          NexoraCard(
            child: Row(
              children: [
                Icon(Icons.storefront_outlined, color: context.colors.primary),
                const SizedBox(width: NexoraSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.saleSellingShelf,
                        style: context.texts.bodySmall,
                      ),
                      Text(
                        state.hasShelf
                            ? '${state.warehouseName} · ${state.locationName}'
                            : l10n.saleNeedShelf,
                        style: context.texts.titleSmall,
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: _pickShelf,
                  child: Text(
                    state.hasShelf ? l10n.saleChangeBuyer : l10n.commonSelect,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          SearchField(
            hint: l10n.saleSearchHint,
            controller: _search,
            onChanged: _onSearchChanged,
          ),
          if (products != null) ...[
            const SizedBox(height: NexoraSpace.sm),
            AsyncPane(
              value: products,
              onRetry: () => ref.invalidate(productOptionsProvider(_query)),
              loading: const Padding(
                padding: EdgeInsets.all(NexoraSpace.md),
                child: Center(child: CircularProgressIndicator()),
              ),
              builder: (items) {
                if (items.isEmpty) {
                  return NexoraCard(
                    child: Text(
                      l10n.commonNoResults,
                      style: context.texts.bodyMedium,
                    ),
                  );
                }
                return NexoraCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final product in items.take(8))
                        ListTile(
                          onTap: () => _add(product),
                          leading: const Icon(Icons.inventory_2_outlined),
                          title: Text(product.name),
                          subtitle: Text(
                            product.isSerialized
                                ? '${product.sku} · ${l10n.saleSerializedTag}'
                                : product.sku,
                            textDirection: TextDirection.ltr,
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (product.salePriceMinor != null)
                                MoneyText(
                                  product.salePriceMinor!,
                                  style: context.texts.bodyMedium,
                                  withCode: false,
                                ),
                              const SizedBox(width: NexoraSpace.xs),
                              const Icon(Icons.add_circle_outline_rounded),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ],
          const SizedBox(height: NexoraSpace.lg),
          if (state.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: NexoraSpace.xl),
              child: EmptyState(
                icon: Icons.point_of_sale_outlined,
                title: l10n.saleEmptyBasket,
                message: l10n.saleSubtitle,
                actionLabel: l10n.scanTitle,
                onAction: () => context.go('/scan'),
              ),
            )
          else ...[
            SectionHeader(title: l10n.saleBasketHeading),
            for (final line in state.lines)
              Padding(
                padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                child: _BasketLine(
                  line: line,
                  onQuantity: (quantity) => ref
                      .read(saleDraftProvider.notifier)
                      .updateQuantity(line.referenceId, quantity),
                  onPrice: () => _editPrice(line),
                  onTax: () => _editTax(line),
                  onRemove: () {
                    ref
                        .read(saleDraftProvider.notifier)
                        .removeLine(line.referenceId);
                  },
                ),
              ),
            const SizedBox(height: NexoraSpace.sm),
            _TotalsCard(state: state),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 8, 20, 8),
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l10n.commonTotal, style: context.texts.bodySmall),
                MoneyText(state.totalMinor, style: context.texts.titleMedium),
              ],
            ),
            const SizedBox(width: NexoraSpace.md),
            Expanded(
              child: FilledButton(
                onPressed: state.isEmpty ? null : _review,
                child: Text(l10n.saleReviewPay),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BasketLine extends StatelessWidget {
  const _BasketLine({
    required this.line,
    required this.onQuantity,
    required this.onPrice,
    required this.onTax,
    required this.onRemove,
  });

  final InvoiceLineDraft line;
  final ValueChanged<double> onQuantity;
  final VoidCallback onPrice;
  final VoidCallback onTax;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final price = line.unitPriceMinor;
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(line.name, style: context.texts.titleSmall),
                    Text(
                      line.isDevice
                          ? '${line.sku} · ${line.serialNumber ?? ''}'
                          : line.sku,
                      style: context.texts.bodySmall,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: l10n.saleRemoveLine,
                onPressed: onRemove,
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          Row(
            children: [
              if (line.isDevice)
                StatusPill(
                  label: l10n.saleSerializedTag,
                  tone: PillTone.primary,
                )
              else
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton.filledTonal(
                      tooltip: l10n.commonRemove,
                      onPressed: () => onQuantity(line.quantity - 1),
                      icon: const Icon(Icons.remove_rounded, size: 18),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: NexoraSpace.sm,
                      ),
                      child: QuantityText(
                        line.quantity,
                        style: context.texts.titleSmall,
                      ),
                    ),
                    IconButton.filledTonal(
                      tooltip: l10n.commonAdd,
                      onPressed: () => onQuantity(line.quantity + 1),
                      icon: const Icon(Icons.add_rounded, size: 18),
                    ),
                  ],
                ),
              const Spacer(),
              TextButton.icon(
                onPressed: onPrice,
                icon: const Icon(Icons.sell_outlined, size: 18),
                label: Text(
                  price == null ? '—' : Money.format(price, withCode: false),
                  textDirection: TextDirection.ltr,
                ),
              ),
              TextButton.icon(
                onPressed: onTax,
                icon: const Icon(Icons.percent_rounded, size: 18),
                label: Text(
                  line.taxRatePercent == null
                      ? '—'
                      : '${formatQuantity(line.taxRatePercent!)}%',
                  textDirection: TextDirection.ltr,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.state});

  final SaleDraftState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final taxByRate = <double, int>{};
    for (final line in state.lines) {
      final rate = line.taxRatePercent ?? 0;
      final net = ((line.unitPriceMinor ?? 0) * line.quantity).round();
      taxByRate[rate] = (taxByRate[rate] ?? 0) + (net * rate / 100).round();
    }
    return NexoraCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KeyValueRow(
            label: l10n.saleSubtotal,
            value: Money.format(state.netMinor),
          ),
          for (final entry in taxByRate.entries)
            if (entry.value > 0)
              KeyValueRow(
                label: l10n.saleVatLine(formatQuantity(entry.key)),
                value: Money.format(entry.value),
              ),
          const Divider(height: NexoraSpace.lg),
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.saleTotalLine,
                  style: context.texts.titleMedium,
                ),
              ),
              MoneyText(state.totalMinor, style: context.texts.titleLarge),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReviewStep extends ConsumerStatefulWidget {
  const _ReviewStep({required this.state});

  final SaleDraftState state;

  @override
  ConsumerState<_ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends ConsumerState<_ReviewStep> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _paid;
  late final TextEditingController _notes;

  @override
  void initState() {
    super.initState();
    final state = widget.state;
    _name = TextEditingController(text: state.buyerName);
    _phone = TextEditingController(text: state.buyerPhone ?? '');
    _email = TextEditingController(text: state.buyerEmail ?? '');
    _paid = TextEditingController(text: Money.input(state.paidAmountMinor));
    _notes = TextEditingController(text: state.notes);
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _paid.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _snack(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  void _setMethod(PaymentMethod method) {
    final controller = ref.read(saleDraftProvider.notifier);
    controller.setPaymentMethod(method);
    final paid = method == PaymentMethod.credit
        ? 0
        : ref.read(saleDraftProvider).totalMinor;
    controller.setPaidAmount(paid);
    _paid.text = Money.input(paid);
  }

  Future<void> _selectCustomer() async {
    final customer = await showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _CustomerSheet(),
    );
    if (customer == null || !mounted) return;
    ref.read(saleDraftProvider.notifier).setCustomer(customer);
    _name.text = customer.name;
    _phone.text = customer.phone ?? '';
    _email.text = customer.email ?? '';
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final state = ref.read(saleDraftProvider);
    if (state.customer == null && _name.text.trim().isEmpty) {
      _snack(l10n.saleNeedBuyer);
      return;
    }
    final paidText = _paid.text.trim();
    int? paid;
    if (state.paymentMethod == PaymentMethod.credit || paidText.isEmpty) {
      paid = 0;
    } else {
      paid = Money.parse(paidText);
      if (paid == null) {
        _snack(l10n.saleAmountInvalid);
        return;
      }
    }
    final controller = ref.read(saleDraftProvider.notifier);
    controller.setBuyerName(_name.text);
    controller.setBuyerPhone(_phone.text);
    controller.setBuyerEmail(_email.text);
    controller.setPaidAmount(paid);
    final posted = await controller.submit();
    if (!posted && mounted) {
      final failure = ref.read(saleDraftProvider).failure;
      if (failure != null) _snack(failureText(context.l10n, failure));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(saleDraftProvider);
    final credit = state.paymentMethod == PaymentMethod.credit;
    final failure = state.failure;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: l10n.commonBack,
          onPressed: state.busy
              ? null
              : () => ref.read(saleDraftProvider.notifier).backToBasket(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.saleReviewTitle, style: context.texts.titleLarge),
            Text(
              l10n.saleReviewSubtitle(formatQuantity(state.totalQuantity)),
              style: context.texts.bodySmall,
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          if (failure != null) ...[
            _FailureBanner(message: failureText(l10n, failure)),
            const SizedBox(height: NexoraSpace.md),
          ],
          SectionHeader(title: l10n.saleBuyerDetails),
          NexoraCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (state.customer != null)
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.customer!.name,
                              style: context.texts.titleSmall,
                            ),
                            if (state.customer!.phone != null)
                              Text(
                                state.customer!.phone!,
                                style: context.texts.bodySmall,
                                textDirection: TextDirection.ltr,
                              ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: _selectCustomer,
                        child: Text(l10n.saleChangeBuyer),
                      ),
                    ],
                  )
                else ...[
                  TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      labelText: l10n.saleCustomerName,
                    ),
                    onChanged: (value) => ref
                        .read(saleDraftProvider.notifier)
                        .setBuyerName(value),
                  ),
                  const SizedBox(height: NexoraSpace.sm),
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: l10n.saleCustomerPhone,
                    ),
                    onChanged: (value) => ref
                        .read(saleDraftProvider.notifier)
                        .setBuyerPhone(value),
                  ),
                  const SizedBox(height: NexoraSpace.sm),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: l10n.saleCustomerEmail,
                    ),
                    onChanged: (value) => ref
                        .read(saleDraftProvider.notifier)
                        .setBuyerEmail(value),
                  ),
                ],
                const SizedBox(height: NexoraSpace.sm),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: _selectCustomer,
                    icon: const Icon(Icons.person_search_outlined),
                    label: Text(l10n.saleSelectCustomer),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.lg),
          SectionHeader(title: l10n.salePaymentMethod),
          NexoraCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: NexoraSpace.sm,
                  runSpacing: NexoraSpace.sm,
                  children: [
                    for (final method in PaymentMethod.values)
                      ChoiceChip(
                        label: Text(paymentMethodLabel(l10n, method)),
                        selected: state.paymentMethod == method,
                        onSelected: state.busy
                            ? null
                            : (_) => _setMethod(method),
                      ),
                  ],
                ),
                if (state.paymentMethod == PaymentMethod.cardManual) ...[
                  const SizedBox(height: NexoraSpace.sm),
                  Text(l10n.saleCardHint, style: context.texts.bodySmall),
                ],
                if (state.paymentMethod == PaymentMethod.credit) ...[
                  const SizedBox(height: NexoraSpace.sm),
                  Text(l10n.saleCreditHint, style: context.texts.bodySmall),
                ],
                if (!credit) ...[
                  const SizedBox(height: NexoraSpace.md),
                  TextField(
                    controller: _paid,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      labelText: l10n.saleCashTendered,
                      suffixText: Money.code,
                    ),
                    onChanged: (value) {
                      final minor = Money.parse(value);
                      if (minor != null) {
                        ref
                            .read(saleDraftProvider.notifier)
                            .setPaidAmount(minor);
                      }
                    },
                  ),
                  if (state.changeMinor > 0) ...[
                    const SizedBox(height: NexoraSpace.sm),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            l10n.saleChangeToReturn,
                            style: context.texts.bodyMedium,
                          ),
                        ),
                        MoneyText(
                          state.changeMinor,
                          style: context.texts.titleSmall,
                        ),
                      ],
                    ),
                    Text(l10n.saleChangeHint, style: context.texts.bodySmall),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.lg),
          SectionHeader(title: l10n.saleAdditionalDetails),
          NexoraCard(
            child: TextField(
              controller: _notes,
              maxLines: 2,
              minLines: 1,
              decoration: InputDecoration(
                hintText: l10n.saleAdditionalHint,
                labelText: l10n.commonNotes,
              ),
              onChanged: (value) =>
                  ref.read(saleDraftProvider.notifier).setNotes(value),
            ),
          ),
          const SizedBox(height: NexoraSpace.lg),
          SectionHeader(title: l10n.saleBasketHeading),
          _TotalsCard(state: state),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 8, 20, 8),
        child: FilledButton(
          onPressed: state.busy ? null : _submit,
          child: state.busy
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: NexoraSpace.sm),
                    Text(l10n.salePosting),
                  ],
                )
              : Text(
                  l10n.saleConfirmSale(
                    Money.format(state.totalMinor, withCode: false),
                  ),
                ),
        ),
      ),
    );
  }
}

class _FailureBanner extends StatelessWidget {
  const _FailureBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(NexoraSpace.md),
    decoration: BoxDecoration(
      color: context.isDark ? const Color(0xFF3E1B1B) : NexoraColors.dangerSoft,
      borderRadius: BorderRadius.circular(NexoraRadius.field),
      border: Border.all(color: context.colors.error.withValues(alpha: 0.35)),
    ),
    child: Row(
      children: [
        Icon(Icons.error_outline_rounded, color: context.colors.error),
        const SizedBox(width: NexoraSpace.sm),
        Expanded(
          child: Text(
            message,
            style: context.texts.bodySmall?.copyWith(
              color: context.colors.error,
            ),
          ),
        ),
      ],
    ),
  );
}

class _DoneStep extends ConsumerWidget {
  const _DoneStep({required this.state});

  final SaleDraftState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final result = state.result!;
    final locale = Localizations.localeOf(context).languageCode;
    final organizationId = ref.watch(organizationIdProvider);
    final api = ref.watch(nexoraApiProvider);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(l10n.saleStepDone),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          const SizedBox(height: NexoraSpace.md),
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: context.isDark
                    ? const Color(0xFF123A2C)
                    : NexoraColors.successSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.check_rounded,
                size: 42,
                color: context.isDark
                    ? const Color(0xFF66D7A6)
                    : NexoraColors.success,
              ),
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          Text(
            l10n.saleCompleteTitle,
            textAlign: TextAlign.center,
            style: context.texts.headlineSmall,
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(
            l10n.saleCompleteBody(
              state.buyerLabel,
              formatQuantity(result.totalQuantity),
              '${state.warehouseName} · ${state.locationName}',
            ),
            textAlign: TextAlign.center,
            style: context.texts.bodyMedium,
          ),
          const SizedBox(height: NexoraSpace.xl),
          NexoraCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.saleInvoice,
                            style: context.texts.bodySmall,
                          ),
                          Text(
                            result.number,
                            style: context.texts.titleMedium,
                            textDirection: TextDirection.ltr,
                          ),
                        ],
                      ),
                    ),
                    StatusPill(
                      label: paymentStatusLabel(l10n, result.paymentStatus),
                      tone: paymentStatusTone(result.paymentStatus),
                    ),
                  ],
                ),
                const Divider(height: NexoraSpace.xl),
                KeyValueRow(
                  label: l10n.saleSubtotal,
                  value: Money.format(result.netAmountMinor),
                ),
                KeyValueRow(
                  label: l10n.commonVat,
                  value: Money.format(result.taxAmountMinor),
                ),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.saleTotalLine,
                        style: context.texts.titleMedium,
                      ),
                    ),
                    MoneyText(
                      result.totalAmountMinor,
                      style: context.texts.titleLarge,
                    ),
                  ],
                ),
                if (result.remainingAmountMinor > 0)
                  KeyValueRow(
                    label: l10n.saleRemainingBalance,
                    value: Money.format(result.remainingAmountMinor),
                  ),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: organizationId == null
                      ? null
                      : () => downloadDocument(
                          context,
                          () => api.invoicePdf(
                            organizationId,
                            result.invoiceId,
                            locale: locale,
                          ),
                        ),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(l10n.saleDownloadInvoice),
                ),
              ),
              const SizedBox(width: NexoraSpace.sm),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: organizationId == null
                      ? null
                      : () => downloadDocument(
                          context,
                          () => api.issueNotePdf(
                            organizationId,
                            result.invoiceId,
                            locale: locale,
                          ),
                        ),
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: Text(l10n.saleDownloadIssueNote),
                ),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.sm),
          OutlinedButton.icon(
            onPressed: () => context.push('/invoices/${result.invoiceId}'),
            icon: const Icon(Icons.open_in_new_rounded),
            label: Text(l10n.saleOpenInvoice),
          ),
          const SizedBox(height: NexoraSpace.lg),
          FilledButton.icon(
            onPressed: () => ref.read(saleDraftProvider.notifier).reset(),
            icon: const Icon(Icons.add_rounded),
            label: Text(l10n.saleNewSale),
          ),
        ],
      ),
    );
  }
}

class _ShelfSheet extends ConsumerWidget {
  const _ShelfSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final warehouses = ref.watch(warehousesProvider);

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.72,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: Text(l10n.saleNeedShelf, style: context.texts.titleLarge),
          ),
          const Divider(height: 1),
          Expanded(
            child: AsyncPane(
              value: warehouses,
              onRetry: () => ref.invalidate(warehousesProvider),
              builder: (items) {
                if (items.isEmpty) {
                  return EmptyState(
                    icon: Icons.warehouse_outlined,
                    title: l10n.commonEmpty,
                    message: l10n.saleNeedShelf,
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 24),
                  children: [
                    for (final warehouse in items)
                      ExpansionTile(
                        leading: const Icon(Icons.warehouse_outlined),
                        title: Text('${warehouse.code} · ${warehouse.name}'),
                        subtitle: warehouse.city == null
                            ? null
                            : Text(warehouse.city!),
                        children: [
                          for (final location in warehouse.activeLocations)
                            ListTile(
                              contentPadding: const EdgeInsetsDirectional.only(
                                start: 32,
                                end: 16,
                              ),
                              leading: const Icon(Icons.shelves),
                              title: Text(location.display),
                              onTap: () => Navigator.of(
                                context,
                              ).pop((warehouse: warehouse, location: location)),
                            ),
                        ],
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CustomerSheet extends ConsumerStatefulWidget {
  const _CustomerSheet();

  @override
  ConsumerState<_CustomerSheet> createState() => _CustomerSheetState();
}

class _CustomerSheetState extends ConsumerState<_CustomerSheet> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final customers = ref.watch(customerOptionsProvider(_query));

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(
                l10n.saleSelectCustomer,
                style: context.texts.titleLarge,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SearchField(
                hint: l10n.commonSearch,
                controller: _search,
                onChanged: _onSearchChanged,
              ),
            ),
            const SizedBox(height: NexoraSpace.sm),
            const Divider(height: 1),
            Expanded(
              child: AsyncPane(
                value: customers,
                onRetry: () => ref.invalidate(customerOptionsProvider(_query)),
                builder: (items) {
                  if (items.isEmpty) {
                    return EmptyState(
                      icon: Icons.person_search_outlined,
                      title: l10n.commonNoResults,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: NexoraSpace.sm),
                    itemBuilder: (context, index) {
                      final customer = items[index];
                      return NexoraCard(
                        onTap: () => Navigator.of(context).pop(customer),
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: context.colors.primaryContainer,
                              foregroundColor: context.colors.primary,
                              child: Text(
                                customer.name.characters.first.toUpperCase(),
                              ),
                            ),
                            const SizedBox(width: NexoraSpace.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    customer.name,
                                    style: context.texts.titleSmall,
                                  ),
                                  if (customer.phone != null)
                                    Text(
                                      customer.phone!,
                                      style: context.texts.bodySmall,
                                      textDirection: TextDirection.ltr,
                                    ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<int?> _askAmount(
  BuildContext context, {
  required String title,
  required int? initial,
}) async {
  final controller = TextEditingController(
    text: initial == null ? '' : Money.input(initial),
  );
  final l10n = context.l10n;
  final value = await showDialog<int>(
    context: context,
    builder: (context) {
      String? error;
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: TextField(
            controller: controller,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(
              suffixText: Money.code,
              errorText: error,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonCancel),
            ),
            FilledButton(
              onPressed: () {
                final minor = Money.parse(controller.text);
                if (minor == null) {
                  setState(() => error = l10n.salePriceInvalid);
                  return;
                }
                Navigator.of(context).pop(minor);
              },
              child: Text(l10n.commonSave),
            ),
          ],
        ),
      );
    },
  );
  controller.dispose();
  return value;
}

Future<double?> _askPercent(BuildContext context, {double? initial}) async {
  final controller = TextEditingController(
    text: initial == null ? '' : formatQuantity(initial),
  );
  final l10n = context.l10n;
  final value = await showDialog<double>(
    context: context,
    builder: (context) {
      String? error;
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(l10n.saleTaxRate),
          content: TextField(
            controller: controller,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            decoration: InputDecoration(suffixText: '%', errorText: error),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l10n.commonCancel),
            ),
            FilledButton(
              onPressed: () {
                final percent = Money.parsePercent(controller.text);
                if (percent == null) {
                  setState(() => error = l10n.commonInvalidNumber);
                  return;
                }
                Navigator.of(context).pop(percent);
              },
              child: Text(l10n.commonSave),
            ),
          ],
        ),
      );
    },
  );
  controller.dispose();
  return value;
}
