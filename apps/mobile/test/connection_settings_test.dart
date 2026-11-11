import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/core/app_providers.dart';
import 'package:nexora_mobile/core/config/connection_settings.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('normalizes a pasted address', () {
    expect(
      normalizeApiBaseUrl(
        '  https://nexora-web-service.onrender.com/api/v1/  ',
      ),
      'https://nexora-web-service.onrender.com/api/v1',
    );
    expect(
      normalizeApiBaseUrl('http://192.168.0.239:4100/api/v1'),
      'http://192.168.0.239:4100/api/v1',
    );
    expect(normalizeApiBaseUrl('   '), isNull);
    expect(normalizeApiBaseUrl(null), isNull);
  });

  test('rejects addresses that are not absolute http(s)', () {
    for (final bad in [
      'nexora.example.com/api/v1',
      'ftp://example.com/api',
      'https://',
      '10.0.2.2:4100/api/v1',
    ]) {
      expect(
        () => normalizeApiBaseUrl(bad),
        throwsFormatException,
        reason: bad,
      );
    }
  });

  test('a saved address overrides the built-in one and can be cleared', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    // Tests build the dev flavor, whose built-in address is the emulator host.
    expect(container.read(apiBaseUrlProvider), 'http://10.0.2.2:4100/api/v1');

    await container
        .read(connectionProvider.notifier)
        .setApiBaseUrl('https://nexora-web-service.onrender.com/api/v1/');
    expect(
      container.read(apiBaseUrlProvider),
      'https://nexora-web-service.onrender.com/api/v1',
    );

    final reloaded = await ConnectionController.load();
    expect(
      reloaded.apiBaseUrl,
      'https://nexora-web-service.onrender.com/api/v1',
    );

    await container.read(connectionProvider.notifier).setApiBaseUrl('  ');
    expect(container.read(connectionProvider).apiBaseUrl, isNull);
    expect(container.read(apiBaseUrlProvider), 'http://10.0.2.2:4100/api/v1');
  });

  test('a stored value that is not a URL is discarded at startup', () async {
    SharedPreferences.setMockInitialValues({
      ConnectionController.apiKey: 'not a url',
    });
    expect((await ConnectionController.load()).apiBaseUrl, isNull);
    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getString(ConnectionController.apiKey), isNull);
  });
}
