import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_providers.dart';
import '../../core/config/connection_settings.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/widgets.dart';

/// Where this device sends its API calls. Stored locally so an installed build
/// can be pointed at another server (Render, a LAN machine) without rebuilding.
class ConnectionScreen extends ConsumerStatefulWidget {
  const ConnectionScreen({super.key});

  @override
  ConsumerState<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends ConsumerState<ConnectionScreen> {
  late final TextEditingController _controller;
  bool _testing = false;
  String? _error;
  _Probe? _probe;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: ref.read(apiBaseUrlProvider) ?? '',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    final l10n = context.l10n;
    final String? base;
    try {
      base = normalizeApiBaseUrl(_controller.text);
    } on FormatException {
      setState(() {
        _error = l10n.connectionInvalid;
        _probe = null;
      });
      return;
    }
    if (base == null) {
      setState(() {
        _error = l10n.connectionInvalid;
        _probe = null;
      });
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _error = null;
      _probe = null;
      _testing = true;
    });

    final origin = Uri.parse(base).origin;
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 60),
        headers: const {'accept': 'application/json'},
      ),
    );
    final started = DateTime.now();
    try {
      final response = await dio.get<dynamic>('$origin/health');
      final elapsed = DateTime.now().difference(started).inMilliseconds;
      if (!mounted) return;
      setState(() {
        _probe = _Probe(
          ok: response.statusCode == 200,
          message: l10n.connectionTestOk(elapsed),
        );
      });
    } on DioException catch (error) {
      if (!mounted) return;
      final status = error.response?.statusCode;
      setState(() {
        _probe = _Probe(
          ok: false,
          message: l10n.connectionTestFailed(
            status == null
                ? (error.message ?? error.type.name)
                : 'HTTP $status',
          ),
        );
      });
    } finally {
      dio.close(force: true);
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    final l10n = context.l10n;
    final String? normalized;
    try {
      normalized = normalizeApiBaseUrl(_controller.text);
    } on FormatException {
      setState(() => _error = l10n.connectionInvalid);
      return;
    }

    await ref.read(connectionProvider.notifier).setApiBaseUrl(normalized);
    _apply();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(l10n.connectionSaved)));
    Navigator.of(context).maybePop();
  }

  Future<void> _reset() async {
    final l10n = context.l10n;
    await ref.read(connectionProvider.notifier).setApiBaseUrl(null);
    _controller.text = ref.read(appConfigProvider).apiBaseUrl;
    _apply();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(l10n.connectionSaved)));
  }

  /// Every API provider watches this client, so saving rebuilds them; the
  /// session is re-read explicitly because it holds the signed-in membership.
  void _apply() {
    final session = ref.read(sessionProvider);
    if (session.userId != null) {
      unawaited(ref.read(sessionProvider.notifier).refreshWorkspace());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final custom = ref.watch(connectionProvider).apiBaseUrl;
    final builtIn = ref.watch(appConfigProvider).apiBaseUrl;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.connectionTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          NexoraCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.connectionIntro, style: context.texts.bodyMedium),
                const SizedBox(height: NexoraSpace.md),
                Row(
                  children: [
                    Icon(
                      custom == null
                          ? Icons.shield_outlined
                          : Icons.tune_rounded,
                      size: 18,
                      color: context.colors.primary,
                    ),
                    const SizedBox(width: NexoraSpace.sm),
                    Expanded(
                      child: Text(
                        custom == null
                            ? (builtIn.isEmpty
                                  ? l10n.connectionNoBuiltIn
                                  : l10n.connectionBuiltIn(builtIn))
                            : l10n.connectionCustom,
                        style: context.texts.bodySmall,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: NexoraSpace.xl),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.url,
            autocorrect: false,
            enableSuggestions: false,
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() {
              _error = null;
              _probe = null;
            }),
            onSubmitted: (_) => _save(),
            decoration: InputDecoration(
              labelText: l10n.connectionApiLabel,
              hintText: l10n.connectionHint,
              errorText: _error,
              prefixIcon: const Icon(Icons.dns_outlined),
            ),
          ),
          const SizedBox(height: NexoraSpace.sm),
          Text(
            l10n.connectionWaking,
            style: context.texts.bodySmall?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: NexoraSpace.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _testing ? null : _test,
                  icon: _testing
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.network_check_rounded),
                  label: Text(
                    _testing ? l10n.connectionTesting : l10n.connectionTest,
                  ),
                ),
              ),
              const SizedBox(width: NexoraSpace.md),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _save,
                  icon: const Icon(Icons.check_rounded),
                  label: Text(l10n.commonSave),
                ),
              ),
            ],
          ),
          if (_probe != null) ...[
            const SizedBox(height: NexoraSpace.lg),
            NexoraCard(
              child: Row(
                children: [
                  Icon(
                    _probe!.ok
                        ? Icons.check_circle_outline_rounded
                        : Icons.error_outline_rounded,
                    color: _probe!.ok
                        ? NexoraColors.success
                        : context.colors.error,
                  ),
                  const SizedBox(width: NexoraSpace.sm),
                  Expanded(
                    child: Text(
                      _probe!.message,
                      style: context.texts.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (custom != null) ...[
            const SizedBox(height: NexoraSpace.md),
            TextButton.icon(
              onPressed: _reset,
              icon: const Icon(Icons.restart_alt_rounded),
              label: Text(l10n.connectionReset),
            ),
          ],
        ],
      ),
    );
  }
}

class _Probe {
  const _Probe({required this.ok, required this.message});

  final bool ok;
  final String message;
}
