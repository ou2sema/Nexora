import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Headers;

import '../data/models/account.dart';
import '../data/nexora_api.dart';
import 'api/api_client.dart';
import 'auth/permissions.dart';
import 'config/app_config.dart';
import 'config/connection_settings.dart';
import 'session/session_controller.dart';

final appConfigProvider = Provider<AppConfig>(
  (ref) => AppConfig.fromEnvironment(),
);

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => Supabase.instance.client,
);

/// The address saved on this device wins over the one baked into the build.
final apiBaseUrlProvider = Provider<String?>((ref) {
  final custom = ref.watch(connectionProvider).apiBaseUrl;
  if (custom != null) return custom;
  final builtIn = ref.watch(appConfigProvider).apiBaseUrl;
  return builtIn.isEmpty ? null : builtIn;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final apiBaseUrl = ref.watch(apiBaseUrlProvider);
  if (apiBaseUrl == null) {
    throw StateError('No API address is configured on this device.');
  }
  return ApiClient(
    apiBaseUrl: apiBaseUrl,
    supabase: ref.watch(supabaseClientProvider),
  );
});

final nexoraApiProvider = Provider<NexoraApi>(
  (ref) => NexoraApi(ref.watch(apiClientProvider)),
);

final sessionProvider = NotifierProvider<SessionController, SessionState>(
  SessionController.new,
);

final activeMembershipProvider = Provider<Membership?>(
  (ref) => ref.watch(sessionProvider).membership,
);

final activeRoleProvider = Provider<MemberRole>(
  (ref) => ref.watch(sessionProvider).role,
);

final organizationIdProvider = Provider<String?>(
  (ref) => ref.watch(sessionProvider).organizationId,
);

class AppPreferences {
  const AppPreferences({this.locale, this.themeMode = ThemeMode.system});

  final Locale? locale;
  final ThemeMode themeMode;
}

class PreferencesController extends Notifier<AppPreferences> {
  static const _localeKey = 'nexora.v1.preference.locale';
  static const _themeKey = 'nexora.v1.preference.theme';

  @override
  AppPreferences build() {
    Future.microtask(_load);
    return const AppPreferences();
  }

  Future<void> _load() async {
    final preferences = await SharedPreferences.getInstance();
    final language = preferences.getString(_localeKey);
    final theme = preferences.getString(_themeKey);
    state = AppPreferences(
      locale: language == null ? null : Locale(language),
      themeMode: switch (theme) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
    );
  }

  Future<void> setLocale(Locale? locale) async {
    final preferences = await SharedPreferences.getInstance();
    if (locale == null) {
      await preferences.remove(_localeKey);
    } else {
      await preferences.setString(_localeKey, locale.languageCode);
    }
    state = AppPreferences(locale: locale, themeMode: state.themeMode);
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_themeKey, mode.name);
    state = AppPreferences(locale: state.locale, themeMode: mode);
  }
}

final preferencesProvider =
    NotifierProvider<PreferencesController, AppPreferences>(
      PreferencesController.new,
    );
