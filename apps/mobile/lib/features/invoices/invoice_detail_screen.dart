import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/idempotency.dart';
import '../../core/app_providers.dart';
import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/documents.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/invoicing.dart';
import '../../data/providers.dart';

class InvoiceDetailScreen extends ConsumerStatefulWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  ConsumerState<InvoiceDetailScreen> createState() =>
      _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends ConsumerState<InvoiceDetailScreen> {
  final _guard = IdempotencyGuard();
  bool _busy = false;

  Future<void> _addPayment(SalesInvoice invoice) async {
    final l10n = context.l10n;
    final entry =
        await showDialog<
          ({int amountMinor, PaymentMethod method, String? note})
        >(
          context: context,
          builder: (_) =>
              _PaymentDialog(remainingMinor: invoice.remainingAmountMinor),
        );
    if (entry == null || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await _guard.run(
        (key) => ref
            .read(nexoraApiProvider)
            .addInvoicePayment(
              organizationId,
              widget.invoiceId,
              amountMinor: entry.amountMinor,
              method: entry.method,
              note: entry.note,
              idempotencyKey: key,
            ),
      );
      ref.invalidate(invoiceProvider(widget.invoiceId));
      ref.invalidate(invoicesProvider);
      ref.invalidate(reportOverviewProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.salePaymentRecorded)));
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
    final value = ref.watch(invoiceProvider(widget.invoiceId));
    final locale = Localizations.localeOf(context).languageCode;
    final organizationId = ref.watch(organizationIdProvider);
    final api = ref.watch(nexoraApiProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.saleInvoice),
        actions: [
          IconButton(
            tooltip: l10n.saleDownloadInvoice,
            onPressed: organizationId == null
                ? null
                : () => downloadDocument(
                    context,
                    () => api.invoicePdf(
                      organizationId,
                      widget.invoiceId,
                      locale: locale,
                    ),
                  ),
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: value.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => FailureView(
          failure: failureOf(error),
          onRetry: () => ref.invalidate(invoiceProvider(widget.invoiceId)),
        ),
        data: (detail) {
          final invoice = detail.invoice;
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(invoiceProvider(widget.invoiceId).future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                NexoraCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              invoice.number,
                              style: context.texts.titleMedium,
                              textDirection: TextDirection.ltr,
                            ),
                          ),
                          StatusPill(
                            label: paymentStatusLabel(
                              l10n,
                              invoice.paymentStatus,
                            ),
                            tone: paymentStatusTone(invoice.paymentStatus),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      KeyValueRow(
                        label: l10n.ordersCustomer,
                        value: invoice.customerName,
                      ),
                      if (invoice.customerPhone != null)
                        KeyValueRow(
                          label: l10n.customersPhone,
                          value: invoice.customerPhone!,
                        ),
                      if (invoice.customerEmail != null)
                        KeyValueRow(
                          label: l10n.commonEmail,
                          value: invoice.customerEmail!,
                        ),
                      KeyValueRow(
                        label: l10n.commonLocation,
                        value:
                            '${invoice.warehouseCode}/${invoice.locationCode}',
                      ),
                      KeyValueRow(
                        label: l10n.reportsIssued,
                        value: formatDateTime(invoice.issuedAt),
                      ),
                      if (invoice.salesOrderNumber != null)
                        KeyValueRow(
                          label: l10n.ordersSalesOrder,
                          value: invoice.salesOrderNumber!,
                        ),
                      if (invoice.reference != null)
                        KeyValueRow(
                          label: l10n.ordersReference,
                          value: invoice.reference!,
                        ),
                      if (invoice.notes != null)
                        KeyValueRow(
                          label: l10n.ordersNotes,
                          value: invoice.notes!,
                        ),
                      if (invoice.createdByEmail != null)
                        KeyValueRow(
                          label: l10n.commonBy(invoice.createdByEmail!),
                          value: '',
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: NexoraSpace.md),
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
                                  widget.invoiceId,
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
                                  widget.invoiceId,
                                  locale: locale,
                                ),
                              ),
                        icon: const Icon(Icons.receipt_long_outlined),
                        label: Text(l10n.saleDownloadIssueNote),
                      ),
                    ),
                  ],
                ),
                if (invoice.salesOrderId != null) ...[
                  const SizedBox(height: NexoraSpace.sm),
                  OutlinedButton.icon(
                    onPressed: () =>
                        context.push('/orders/sales/${invoice.salesOrderId}'),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: Text(l10n.ordersSalesOrder),
                  ),
                ],
                const SizedBox(height: NexoraSpace.lg),
                NexoraCard(
                  child: Column(
                    children: [
                      KeyValueRow(
                        label: l10n.saleSubtotal,
                        value: Money.format(invoice.netAmountMinor),
                      ),
                      KeyValueRow(
                        label: l10n.commonVat,
                        value: Money.format(invoice.taxAmountMinor),
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
                            invoice.totalAmountMinor,
                            style: context.texts.titleLarge,
                          ),
                        ],
                      ),
                      const Divider(height: NexoraSpace.lg),
                      KeyValueRow(
                        label: l10n.salePaidInFull,
                        value: Money.format(invoice.paidAmountMinor),
                      ),
                      KeyValueRow(
                        label: l10n.saleRemainingBalance,
                        value: Money.format(invoice.remainingAmountMinor),
                      ),
                    ],
                  ),
                ),
                if (role.canWrite && invoice.remainingAmountMinor > 0) ...[
                  const SizedBox(height: NexoraSpace.md),
                  FilledButton.icon(
                    onPressed: _busy ? null : () => _addPayment(invoice),
                    icon: const Icon(Icons.payments_outlined),
                    label: Text(l10n.saleRecordPayment),
                  ),
                ],
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.ordersLines(detail.lines.length)),
                for (final line in detail.lines)
                  Padding(
                    padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                    child: _InvoiceLineRow(line: line),
                  ),
                const SizedBox(height: NexoraSpace.xl),
                SectionHeader(title: l10n.salePayments),
                if (detail.payments.isEmpty)
                  NexoraCard(
                    child: Text(
                      l10n.commonEmpty,
                      style: context.texts.bodyMedium,
                    ),
                  )
                else
                  for (final payment in detail.payments)
                    Padding(
                      padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
                      child: _PaymentRow(payment: payment),
                    ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _InvoiceLineRow extends StatelessWidget {
  const _InvoiceLineRow({required this.line});

  final SalesInvoiceLine line;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  line.productName,
                  style: context.texts.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              MoneyText(
                line.netAmountMinor + line.taxAmountMinor,
                withCode: false,
              ),
            ],
          ),
          Text(
            line.serialNumber == null
                ? '${line.productSku} · ${formatQuantity(line.quantity)} × '
                      '${Money.format(line.unitPriceMinor)}'
                : '${line.productSku} · ${line.serialNumber}',
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
          Text(
            '${l10n.commonVat} ${formatQuantity(line.taxRatePercent)}% · '
            '${Money.format(line.taxAmountMinor)}',
            style: context.texts.bodySmall,
            textDirection: TextDirection.ltr,
          ),
        ],
      ),
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.payment});

  final SalesInvoicePayment payment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  paymentMethodLabel(l10n, payment.method),
                  style: context.texts.titleSmall,
                ),
                Text(
                  formatDateTime(payment.recordedAt),
                  style: context.texts.bodySmall,
                ),
                if (payment.note != null)
                  Text(payment.note!, style: context.texts.bodySmall),
                if (payment.recordedByEmail != null)
                  Text(
                    l10n.commonBy(payment.recordedByEmail!),
                    style: context.texts.bodySmall,
                  ),
              ],
            ),
          ),
          MoneyText(payment.amountMinor, style: context.texts.titleSmall),
        ],
      ),
    );
  }
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({required this.remainingMinor});

  final int remainingMinor;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  late final _amount = TextEditingController(
    text: Money.input(widget.remainingMinor),
  );
  final _note = TextEditingController();
  PaymentMethod _method = PaymentMethod.cash;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final l10n = context.l10n;
    final amount = Money.parse(_amount.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = l10n.commonInvalidAmount);
      return;
    }
    if (amount > widget.remainingMinor) {
      setState(() => _error = l10n.saleAmountInvalid);
      return;
    }
    Navigator.of(context).pop((
      amountMinor: amount,
      method: _method,
      note: _note.text.trim().isEmpty ? null : _note.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.saleRecordPayment),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _amount,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
            ],
            decoration: InputDecoration(labelText: l10n.salePaymentAmount),
          ),
          const SizedBox(height: NexoraSpace.md),
          DropdownButtonFormField<PaymentMethod>(
            initialValue: _method,
            decoration: InputDecoration(labelText: l10n.salePaymentMethod),
            items: [
              for (final method in PaymentMethod.values)
                DropdownMenuItem(
                  value: method,
                  child: Text(paymentMethodLabel(l10n, method)),
                ),
            ],
            onChanged: (value) =>
                setState(() => _method = value ?? PaymentMethod.cash),
          ),
          const SizedBox(height: NexoraSpace.md),
          TextField(
            controller: _note,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: l10n.salePaymentNote,
              helperText: l10n.commonOptional,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: NexoraSpace.sm),
            Text(_error!, style: TextStyle(color: context.colors.error)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(onPressed: _submit, child: Text(l10n.commonSave)),
      ],
    );
  }
}
