import '../errors/api_exception.dart';
import '../../l10n/app_localizations.dart';

ApiException failureOf(Object error) => error is ApiException
    ? error
    : ApiException(
        kind: ApiFailureKind.unknown,
        code: 'unknown',
        message: error.toString(),
      );

/// The sentence a cashier reads. The server code wins over the HTTP status, so a
/// 409 caused by insufficient stock never reads like a generic conflict.
String failureText(AppLocalizations l10n, ApiException failure) {
  return switch (failure.code) {
    'idempotency_conflict' => l10n.errorIdempotency,
    'insufficient_stock' => l10n.errorInsufficientStock,
    'network_error' => l10n.errorNetwork,
    'api_not_configured' => l10n.errorApiNotConfigured,
    'timeout' => l10n.errorTimeout,
    'unauthorized' => l10n.errorSessionExpired,
    'forbidden' => l10n.errorForbidden,
    'not_found' => l10n.errorNotFound,
    'validation_error' || 'invalid_request' => l10n.errorValidation,
    'rate_limited' => l10n.errorRateLimited(30),
    _ => switch (failure.kind) {
      ApiFailureKind.network => l10n.errorNetwork,
      ApiFailureKind.timeout => l10n.errorTimeout,
      ApiFailureKind.cancelled => l10n.errorUnknown,
      ApiFailureKind.unauthorized => l10n.errorSessionExpired,
      ApiFailureKind.forbidden => l10n.errorForbidden,
      ApiFailureKind.notFound => l10n.errorNotFound,
      ApiFailureKind.conflict => l10n.errorConflict,
      ApiFailureKind.validation => l10n.errorValidation,
      ApiFailureKind.rateLimited => l10n.errorRateLimited(30),
      ApiFailureKind.server => l10n.errorServer,
      ApiFailureKind.unknown => l10n.errorUnknown,
    },
  };
}
