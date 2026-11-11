import 'dart:convert';

import 'package:dio/dio.dart';

enum ApiFailureKind {
  network,
  timeout,
  cancelled,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  server,
  unknown,
}

/// Typed failure for every API call. Screens translate it through
/// `messageForFailure` so the server code, not the HTTP status alone, decides.
class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.code,
    required this.message,
    this.statusCode,
    this.requestId,
    this.details,
    this.cause,
  });

  final ApiFailureKind kind;
  final String code;
  final String message;
  final int? statusCode;
  final String? requestId;
  final Object? details;
  final Object? cause;

  bool get isUnauthorized => kind == ApiFailureKind.unauthorized;
  bool get isConflict =>
      kind == ApiFailureKind.conflict || code == 'idempotency_conflict';
  bool get isValidation => kind == ApiFailureKind.validation;

  /// True when the outcome cannot be known: the write may or may not have landed,
  /// so the same idempotency key must be retried rather than a new one minted.
  bool get isUncertain =>
      kind == ApiFailureKind.network ||
      kind == ApiFailureKind.timeout ||
      kind == ApiFailureKind.cancelled ||
      kind == ApiFailureKind.server ||
      kind == ApiFailureKind.unknown;

  factory ApiException.fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return ApiException(
          kind: ApiFailureKind.timeout,
          code: 'timeout',
          message: 'The request took too long.',
          cause: error,
        );
      case DioExceptionType.cancel:
        return ApiException(
          kind: ApiFailureKind.cancelled,
          code: 'cancelled',
          message: 'The request was cancelled.',
          cause: error,
        );
      case DioExceptionType.badCertificate:
      case DioExceptionType.connectionError:
        return ApiException(
          kind: ApiFailureKind.network,
          code: 'network_error',
          message: 'The API could not be reached.',
          cause: error,
        );
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        return _fromResponse(error);
    }
  }

  factory ApiException.fromResponse(Response<dynamic> response) {
    final status = response.statusCode;
    final headerId = response.headers.value('x-request-id');
    final body = response.data;
    Map<String, dynamic>? envelope;
    if (body is Map<String, dynamic> && body['error'] is Map<String, dynamic>) {
      envelope = body['error'] as Map<String, dynamic>;
    } else if (body is String && body.isNotEmpty) {
      try {
        final decoded = _decode(body);
        if (decoded is Map<String, dynamic> &&
            decoded['error'] is Map<String, dynamic>) {
          envelope = decoded['error'] as Map<String, dynamic>;
        }
      } catch (_) {
        // Non-JSON error bodies fall back to the status code.
      }
    }

    final code = envelope?['code'] as String? ?? _codeForStatus(status);
    final message = envelope?['message'] as String? ?? 'The request failed.';
    final requestId = envelope?['requestId'] as String? ?? headerId;
    return ApiException(
      kind: _kindFor(status, code),
      code: code,
      message: message,
      statusCode: status,
      requestId: requestId,
      details: envelope?['details'],
    );
  }

  static ApiException _fromResponse(DioException error) {
    final response = error.response;
    if (response == null) {
      return ApiException(
        kind: ApiFailureKind.network,
        code: 'network_error',
        message: 'The API could not be reached.',
        cause: error,
      );
    }
    final parsed = ApiException.fromResponse(response);
    return ApiException(
      kind: parsed.kind,
      code: parsed.code,
      message: parsed.message,
      statusCode: parsed.statusCode,
      requestId: parsed.requestId,
      details: parsed.details,
      cause: error,
    );
  }

  static ApiFailureKind _kindFor(int? status, String code) {
    if (code == 'idempotency_conflict' || status == 409) {
      return ApiFailureKind.conflict;
    }
    if (code == 'insufficient_stock') {
      return ApiFailureKind.conflict;
    }
    return switch (status) {
      401 => ApiFailureKind.unauthorized,
      403 => ApiFailureKind.forbidden,
      404 => ApiFailureKind.notFound,
      422 || 400 => ApiFailureKind.validation,
      429 => ApiFailureKind.rateLimited,
      final int value when value >= 500 => ApiFailureKind.server,
      _ => ApiFailureKind.unknown,
    };
  }

  static String _codeForStatus(int? status) => switch (status) {
    400 => 'validation_error',
    401 => 'unauthorized',
    403 => 'forbidden',
    404 => 'not_found',
    409 => 'conflict',
    429 => 'rate_limited',
    final int value when value >= 500 => 'internal_error',
    _ => 'request_failed',
  };

  static Object? _decode(String body) => jsonDecode(body);

  @override
  String toString() =>
      'ApiException($code, status: $statusCode, requestId: $requestId)';
}
