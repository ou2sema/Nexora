import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/widgets.dart';

class BootScreen extends ConsumerWidget {
  const BootScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final failure = session.failure;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(NexoraSpace.xl),
            child: failure == null
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Image.asset(
                          'assets/images/logo-icon.png',
                          width: 84,
                          height: 72,
                          fit: BoxFit.contain,
                        ),
                      ),
                      const SizedBox(height: NexoraSpace.lg),
                      Text('Nexora', style: context.texts.headlineMedium),
                      const SizedBox(height: NexoraSpace.xl),
                      const SizedBox.square(
                        dimension: 26,
                        child: CircularProgressIndicator(strokeWidth: 2.5),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FailureView(failure: failure),
                      const SizedBox(height: NexoraSpace.md),
                      Wrap(
                        spacing: NexoraSpace.md,
                        runSpacing: NexoraSpace.sm,
                        alignment: WrapAlignment.center,
                        children: [
                          FilledButton(
                            onPressed: () => ref
                                .read(sessionProvider.notifier)
                                .refreshWorkspace(),
                            child: Text(context.l10n.commonRetry),
                          ),
                          OutlinedButton(
                            onPressed: () => context.push('/connection'),
                            child: Text(context.l10n.connectionTitle),
                          ),
                          TextButton(
                            onPressed: () =>
                                ref.read(sessionProvider.notifier).signOut(),
                            child: Text(context.l10n.commonSignOut),
                          ),
                        ],
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
