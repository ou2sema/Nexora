import 'package:flutter/foundation.dart';

enum AppFlavor {
  dev,
  staging,
  prod;

  static AppFlavor parse(String value) => switch (value) {
    'prod' => AppFlavor.prod,
    'staging' => AppFlavor.staging,
    _ => AppFlavor.dev,
  };
}

/// Runtime configuration. Nothing secret is embedded: the Supabase URL and
/// publishable key come from `--dart-define`, and the service-role key, database
/// password and JWT secret never leave the API.
@immutable
class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.apiBaseUrl,
    required this.supabaseUrl,
    required this.supabaseKey,
  });

  final AppFlavor flavor;
  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseKey;

  bool get isConfigured =>
      apiBaseUrl.isNotEmpty && supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;

  factory AppConfig.fromEnvironment() {
    const flavor = String.fromEnvironment('APP_FLAVOR', defaultValue: 'dev');
    const apiOverride = String.fromEnvironment('API_BASE_URL');
    const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
    const supabaseKey = String.fromEnvironment('SUPABASE_ANON_KEY');

    final parsed = AppFlavor.parse(flavor);
    final defaultApi = switch (parsed) {
      // 10.0.2.2 reaches the host machine from the Android emulator.
      AppFlavor.dev => 'http://10.0.2.2:4100/api/v1',
      AppFlavor.staging => '',
      AppFlavor.prod => 'https://nexora-web-service.onrender.com/api/v1',
    };

    return AppConfig(
      flavor: parsed,
      apiBaseUrl: _trimSlash(apiOverride.isNotEmpty ? apiOverride : defaultApi),
      supabaseUrl: _trimSlash(supabaseUrl),
      supabaseKey: supabaseKey,
    );
  }

  String get label => switch (flavor) {
    AppFlavor.dev => 'Nexora Dev',
    AppFlavor.staging => 'Nexora Staging',
    AppFlavor.prod => 'Nexora',
  };

  static String _trimSlash(String value) =>
      value.endsWith('/') ? value.substring(0, value.length - 1) : value;
}
