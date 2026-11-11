import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';
import '../../data/providers.dart';

class SuppliersScreen extends ConsumerStatefulWidget {
  const SuppliersScreen({super.key});

  @override
  ConsumerState<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends ConsumerState<SuppliersScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _search = '';
  bool? _isActive;
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

  void _selectActive(bool? value) => setState(() {
    _isActive = value;
    _page = 1;
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final suppliers = ref.watch(
      suppliersProvider((search: _search, isActive: _isActive, page: _page)),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.suppliersTitle),
        actions: [
          if (role.canWrite)
            IconButton(
              tooltip: l10n.suppliersNew,
              onPressed: () => context.push('/suppliers/new'),
              icon: const Icon(Icons.add_rounded),
            ),
          const SizedBox(width: NexoraSpace.sm),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: SearchField(
              hint: l10n.suppliersSearchHint,
              controller: _searchController,
              onChanged: _onSearch,
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(l10n.commonAll),
                    selected: _isActive == null,
                    onSelected: (_) => _selectActive(null),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(l10n.suppliersActive),
                    selected: _isActive == true,
                    onSelected: (_) => _selectActive(true),
                  ),
                ),
                FilterChip(
                  label: Text(l10n.suppliersInactive),
                  selected: _isActive == false,
                  onSelected: (_) => _selectActive(false),
                ),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.sm),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(
                suppliersProvider((
                  search: _search,
                  isActive: _isActive,
                  page: _page,
                )).future,
              ),
              child: suppliers.when(
                data: (page) => page.items.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(20),
                        children: [
                          const SizedBox(height: 48),
                          EmptyState(
                            icon: Icons.local_shipping_outlined,
                            title: l10n.suppliersNoSuppliers,
                            actionLabel: role.canWrite
                                ? l10n.suppliersNew
                                : null,
                            onAction: role.canWrite
                                ? () => context.push('/suppliers/new')
                                : null,
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        children: [
                          for (final supplier in page.items)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: NexoraSpace.sm,
                              ),
                              child: NexoraCard(
                                onTap: () => context.push(
                                  '/suppliers/${supplier.id}/edit',
                                  extra: supplier,
                                ),
                                padding: const EdgeInsets.all(NexoraSpace.md),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor:
                                          context.colors.primaryContainer,
                                      foregroundColor:
                                          context.colors.onPrimaryContainer,
                                      child: const Icon(
                                        Icons.local_shipping_outlined,
                                      ),
                                    ),
                                    const SizedBox(width: NexoraSpace.md),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            supplier.name,
                                            style: context.texts.titleSmall,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          Text(
                                            [
                                              ?supplier.contactName,
                                              ?supplier.phone,
                                              ?supplier.city,
                                            ].join(' · '),
                                            style: context.texts.bodySmall,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    StatusPill(
                                      label: supplier.isActive
                                          ? l10n.suppliersActive
                                          : l10n.suppliersInactive,
                                      tone: supplier.isActive
                                          ? PillTone.success
                                          : PillTone.neutral,
                                    ),
                                  ],
                                ),
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
                  onRetry: () => ref.invalidate(suppliersProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
