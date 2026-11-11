import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/core/api/idempotency.dart';
import 'package:nexora_mobile/core/errors/api_exception.dart';

ApiException _failure(ApiFailureKind kind) =>
    ApiException(kind: kind, code: kind.name, message: kind.name);

void main() {
  test('a successful write settles the key', () async {
    final guard = IdempotencyGuard();
    final first = await guard.run((key) async => key);

    expect(guard.isPending, isFalse);
    final second = await guard.run((key) async => key);
    expect(second, isNot(first));
  });

  test('an uncertain failure keeps the same key for the retry', () async {
    for (final kind in [
      ApiFailureKind.network,
      ApiFailureKind.timeout,
      ApiFailureKind.cancelled,
      ApiFailureKind.server,
      ApiFailureKind.unknown,
    ]) {
      final current = IdempotencyGuard();
      String? sent;
      await expectLater(
        current.run<String>((key) async {
          sent = key;
          throw _failure(kind);
        }),
        throwsA(isA<ApiException>()),
      );
      expect(current.isPending, isTrue, reason: '$kind must stay pending');

      final retried = await current.run((key) async => key);
      expect(retried, sent, reason: '$kind must retry the same key');
      expect(current.isPending, isFalse);
    }
  });

  test('a definitive business failure rotates the key', () async {
    for (final kind in [
      ApiFailureKind.validation,
      ApiFailureKind.conflict,
      ApiFailureKind.forbidden,
      ApiFailureKind.notFound,
      ApiFailureKind.rateLimited,
    ]) {
      final guard = IdempotencyGuard();
      String? sent;
      await expectLater(
        guard.run<String>((key) async {
          sent = key;
          throw _failure(kind);
        }),
        throwsA(isA<ApiException>()),
      );
      expect(guard.isPending, isFalse, reason: '$kind is settled');

      final next = await guard.run((key) async => key);
      expect(next, isNot(sent), reason: '$kind must mint a new key');
    }
  });

  test('the key is stable until the write is settled', () {
    final guard = IdempotencyGuard();
    final key = guard.key;

    expect(guard.isPending, isTrue);
    expect(guard.key, key);
    guard.settle();
    expect(guard.isPending, isFalse);
    expect(guard.key, isNot(key));
  });
}
