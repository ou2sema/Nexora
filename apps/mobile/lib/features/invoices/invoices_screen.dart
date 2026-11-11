import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money/money.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/dates.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/labels.dart';
import '../../core/ui/widgets.dart';
import '../../data/models/invoicing.dart';
import '../../data/providers.dart';

class InvoicesScreen extends ConsumerStatefulWidget {
  const InvoicesScreen({super.key});

  @override
  ConsumerState<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends ConsumerState<InvoicesScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  String? _paymentStatus;
  int _page = 1;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() {
        _search = value.trim();
        _page = 1;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final invoices = ref.watch(
      invoicesProvider((
        search: _search,
        paymentStatus: _paymentStatus,
        page: _page,
      )),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.moreInvoices),
        actions: [
          IconButton(
            tooltip: l10n.saleNewSale,
            onPressed: () => context.go('/sell'),
            icon: const Icon(Icons.add_rounded),
          ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: SearchField(
              hint: l10n.saleSearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: DropdownButtonFormField<String?>(
              initialValue: _paymentStatus,
              isExpanded: true,
              decoration: InputDecoration(labelText: l10n.salePayments),
              items: [
                DropdownMenuItem(value: null, child: Text(l10n.commonAll)),
                for (final status in PaymentStatus.values)
                  DropdownMenuItem(
                    value: status.name,
                    child: Text(paymentStatusLabel(l10n, status)),
                  ),
              ],
              onChanged: (value) => setState(() {
                _paymentStatus = value;
                _page = 1;
              }),
            ),
          ),
          const SizedBox(height: NexoraSpace.md),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                invoicesProvider((
                  search: _search,
                  paymentStatus: _paymentStatus,
                  page: _page,
                )).future,
              ),
              child: invoices.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.receipt_outlined,
                            title: l10n.commonEmpty,
                            message: l10n.saleNoInvoices,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final invoice in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: _InvoiceRow(
                                invoice: invoice,
                                onTap: () =>
                                    context.push('/invoices/${invoice.id}'),
                              ),
                            ),
                          ListPager(
                            page: page.page,
                            pages: page.pageCount,
                            onPrevious: _page > 1
                                ? () => setState(() => _page--)
                                : null,
                            onNext: page.hasMore
                                ? () => setState(() => _page++)
                                : null,
                          ),
                        ],
                      ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => FailureView(
                  failure: failureOf(error),
                  onRetry: () => ref.invalidate(invoicesProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  const _InvoiceRow({required this.invoice, required this.onTap});

  final SalesInvoice invoice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NexoraCard(
      onTap: onTap,
      padding: const EdgeInsets.all(NexoraSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  invoice.number,
                  style: context.texts.titleSmall,
                  textDirection: TextDirection.ltr,
                ),
              ),
              StatusPill(
                label: paymentStatusLabel(l10n, invoice.paymentStatus),
                tone: paymentStatusTone(invoice.paymentStatus),
              ),
            ],
          ),
          const SizedBox(height: NexoraSpace.xs),
          Text(invoice.customerName, style: context.texts.bodyMedium),
          Row(
            children: [
              Text(
                formatDate(invoice.issuedAt),
                style: context.texts.bodySmall,
              ),
              const Spacer(),
              MoneyText(
                invoice.totalAmountMinor,
                style: context.texts.titleSmall,
              ),
            ],
          ),
          if (invoice.remainingAmountMinor > 0)
            Text(
              '${l10n.saleRemainingBalance} ${Money.format(invoice.remainingAmountMinor)}',
              style: context.texts.bodySmall,
              textDirection: TextDirection.ltr,
            ),
        ],
      ),
    );
  }
}
