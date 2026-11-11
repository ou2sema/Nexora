import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Non-sensitive, user+organization-scoped storage for drafts and the last
/// workspace. The namespace is part of every key, so a second account on the
/// same phone can never read the first account's cashier basket.
class ScopedStore {
  ScopedStore._(
    this._preferences, {
    required this._userId,
    required this._organizationId,
  });

  static const _prefix = 'nexora.v1';

  final SharedPreferences _preferences;
  final String _userId;
  final String? _organizationId;

  static Future<ScopedStore> open({
    required String userId,
    required String? organizationId,
  }) async {
    final preferences = await SharedPreferences.getInstance();
    return ScopedStore._(
      preferences,
      userId: userId,
      organizationId: organizationId,
    );
  }

  String get _namespace =>
      '$_prefix.draft.$_userId.${_organizationId ?? 'no-org'}';

  String key(String name) => '$_namespace.$name';

  String? read(String name) => _preferences.getString(key(name));

  Future<void> write(String name, String value) =>
      _preferences.setString(key(name), value);

  Future<void> remove(String name) => _preferences.remove(key(name));

  Map<String, dynamic>? readJson(String name) {
    final raw = read(name);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  Future<void> writeJson(String name, Object value) =>
      write(name, jsonEncode(value));

  Future<void> clearDrafts() async {
    final keys = _preferences
        .getKeys()
        .where((key) => key.startsWith(_namespace))
        .toList();
    for (final key in keys) {
      await _preferences.remove(key);
    }
  }

  static Future<String?> readSelectedOrganization(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    return preferences.getString('$_prefix.org.$userId');
  }

  static Future<void> writeSelectedOrganization(
    String userId,
    String organizationId,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString('$_prefix.org.$userId', organizationId);
  }

  static Future<void> clearSelectedOrganization(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove('$_prefix.org.$userId');
  }

  /// Called on sign-out: drafts belong to the session, the workspace choice does not.
  static Future<void> clearUserDrafts(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    final prefix = '$_prefix.draft.$userId.';
    final keys = preferences
        .getKeys()
        .where((key) => key.startsWith(prefix))
        .toList();
    for (final key in keys) {
      await preferences.remove(key);
    }
  }

  static Future<void> clearAllLocalState() async {
    final preferences = await SharedPreferences.getInstance();
    final keys = preferences
        .getKeys()
        .where((key) => key.startsWith('$_prefix.'))
        .toList();
    for (final key in keys) {
      await preferences.remove(key);
    }
  }
}
