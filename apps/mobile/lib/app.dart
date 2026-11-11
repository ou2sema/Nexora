import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app_providers.dart';
import 'core/theme/nexora_theme.dart';
import 'l10n/app_localizations.dart';
import 'router/app_router.dart';

class NexoraApp extends ConsumerWidget {
  const NexoraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferences = ref.watch(preferencesProvider);
    final languageCode =
        preferences.locale?.languageCode ??
        PlatformDispatcher.instance.locale.languageCode;

    return MaterialApp.router(
      onGenerateTitle: (context) => 'Nexora',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: buildNexoraTheme(dark: false, languageCode: languageCode),
      darkTheme: buildNexoraTheme(dark: true, languageCode: languageCode),
      themeMode: preferences.themeMode,
      locale: preferences.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      // Money and quantities print Latin digits everywhere; this keeps the
      // rest of the Material layer on the same setting in Arabic.
      localeListResolutionCallback: (locales, supported) {
        if (locales == null || locales.isEmpty) return supported.first;
        for (final locale in locales) {
          for (final candidate in supported) {
            if (candidate.languageCode == locale.languageCode) return candidate;
          }
        }
        return supported.first;
      },
    );
  }
}
