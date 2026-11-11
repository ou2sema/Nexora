import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/core/config/app_config.dart';
import 'package:nexora_mobile/core/ui/widgets.dart';
import 'package:nexora_mobile/l10n/app_localizations.dart';
import 'package:nexora_mobile/main.dart';

void main() {
  testWidgets('an unconfigured build names the missing settings', (
    tester,
  ) async {
    await tester.pumpWidget(
      const UnconfiguredApp(
        config: AppConfig(
          flavor: AppFlavor.dev,
          apiBaseUrl: '',
          supabaseUrl: '',
          supabaseKey: '',
        ),
      ),
    );

    expect(find.text('Nexora Dev'), findsOneWidget);
    expect(find.textContaining('SUPABASE_URL'), findsOneWidget);
    expect(
      find.textContaining(
        'The service-role key, database password and JWT secret',
      ),
      findsOneWidget,
    );
  });

  test('a build is configured only when all three settings are present', () {
    const complete = AppConfig(
      flavor: AppFlavor.staging,
      apiBaseUrl: 'https://api.example.com/api/v1',
      supabaseUrl: 'https://project.supabase.co',
      supabaseKey: 'publishable',
    );

    expect(complete.isConfigured, isTrue);
    expect(
      const AppConfig(
        flavor: AppFlavor.staging,
        apiBaseUrl: 'https://api.example.com/api/v1',
        supabaseUrl: '',
        supabaseKey: 'publishable',
      ).isConfigured,
      isFalse,
    );
    expect(AppFlavor.parse('prod'), AppFlavor.prod);
    expect(AppFlavor.parse('unknown'), AppFlavor.dev);
  });

  testWidgets('Arabic renders right to left but money keeps Latin digits', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: Column(
              children: [
                Text(AppLocalizations.of(context).commonSuccess),
                const MoneyText(1234567),
                const QuantityText(1234.5),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('تم'), findsOneWidget);
    expect(find.text('1,234.567 TND'), findsOneWidget);
    expect(find.text('1,234.5'), findsOneWidget);

    final money = tester.widget<Text>(find.text('1,234.567 TND'));
    expect(money.textDirection, TextDirection.ltr);
    expect(
      Directionality.of(tester.element(find.text('تم'))),
      TextDirection.rtl,
    );
  });

  test('every supported locale has the language and session copy', () {
    for (final locale in AppLocalizations.supportedLocales) {
      final l10n = lookupAppLocalizations(locale);
      expect(
        l10n.commonSuccess,
        isNotEmpty,
        reason: '${locale.languageCode} commonSuccess',
      );
      expect(
        l10n.languageSystem,
        isNotEmpty,
        reason: '${locale.languageCode} languageSystem',
      );
      expect(
        l10n.errorInsufficientStock,
        isNotEmpty,
        reason: '${locale.languageCode} stock',
      );
      expect(
        l10n.errorIdempotency,
        isNotEmpty,
        reason: '${locale.languageCode} idempotency',
      );
    }
  });

  test('supported locales are English, French and Arabic', () {
    expect(
      AppLocalizations.supportedLocales
          .map((locale) => locale.languageCode)
          .toSet(),
      {'en', 'fr', 'ar'},
    );
  });
}
