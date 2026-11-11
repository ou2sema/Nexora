import 'package:uuid/uuid.dart';

import '../errors/api_exception.dart';

/// Keeps one idempotency key for a logical write until that write is settled.
/// A timeout or a dropped connection is not settled: retrying with the same key
/// is what proves whether the first attempt landed. Only a definitive answer
/// (success or a business error) rotates the key.
class IdempotencyGuard {
  String? _key;

  String get key => _key ??= const Uuid().v4();

  bool get isPending => _key != null;

  void settle() => _key = null;

  Future<T> run<T>(Future<T> Function(String idempotencyKey) action) async {
    try {
      final result = await action(key);
      settle();
      return result;
    } on ApiException catch (error) {
      if (!error.isUncertain) settle();
      rethrow;
    }
  }
}
