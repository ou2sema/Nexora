import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The API address chosen on this device. Null means "use the address the
/// build was made with". It is not a secret: the Supabase token stays the
/// credential, and the address only says where requests are sent.
@immutable
class ConnectionSettings {
  const ConnectionSettings({this.apiBaseUrl});

  final String? apiBaseUrl;
}

/// Filled from storage in `main` so the first request already uses the saved
/// address instead of flashing the built-in one.
final initialConnectionProvider = Provider<ConnectionSettings>(
  (ref) => const ConnectionSettings(),
);

class ConnectionController extends Notifier<ConnectionSettings> {
  /// Global on purpose: the address must be settable before anyone signs in.
  static const apiKey = 'nexora.v1.connection.api_base_url';

  @override
  ConnectionSettings build() => ref.watch(initialConnectionProvider);

  Future<void> setApiBaseUrl(String? raw) async {
    final value = normalizeApiBaseUrl(raw);
    final preferences = await SharedPreferences.getInstance();
    if (value == null) {
      await preferences.remove(apiKey);
    } else {
      await preferences.setString(apiKey, value);
    }
    state = ConnectionSettings(apiBaseUrl: value);
  }

  static Future<ConnectionSettings> load() async {
    final preferences = await SharedPreferences.getInstance();
    final stored = preferences.getString(apiKey);
    if (stored == null) return const ConnectionSettings();
    try {
      return ConnectionSettings(apiBaseUrl: normalizeApiBaseUrl(stored));
    } on FormatException {
      // A hand-edited or corrupt value must not keep the app from opening.
      await preferences.remove(apiKey);
      return const ConnectionSettings();
    }
  }
}

final connectionProvider =
    NotifierProvider<ConnectionController, ConnectionSettings>(
      ConnectionController.new,
    );

/// Blank input clears the override. Anything else must be an absolute http(s)
/// address with a host; the trailing slash is dropped so paths concatenate.
String? normalizeApiBaseUrl(String? raw) {
  final trimmed = raw?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  final uri = Uri.tryParse(trimmed);
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      (!uri.isScheme('http') && !uri.isScheme('https'))) {
    throw FormatException('Not an absolute http(s) address', trimmed);
  }
  return trimmed.endsWith('/')
      ? trimmed.substring(0, trimmed.length - 1)
      : trimmed;
}
