import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/core/errors/api_exception.dart';

Response<dynamic> _response({
  required int status,
  Object? data,
  Map<String, List<String>> headers = const {},
}) => Response<dynamic>(
  requestOptions: RequestOptions(path: '/api/v1/test'),
  statusCode: status,
  data: data,
  headers: Headers.fromMap(headers),
);

void main() {
  group('ApiException.fromResponse', () {
    test('reads the server envelope and keeps its request id', () {
      final failure = ApiException.fromResponse(
        _response(
          status: 409,
          data: {
            'error': {
              'code': 'insufficient_stock',
              'message': 'Not enough stock.',
              'requestId': 'req_1',
            },
          },
        ),
      );

      expect(failure.code, 'insufficient_stock');
      expect(failure.message, 'Not enough stock.');
      expect(failure.requestId, 'req_1');
      expect(failure.kind, ApiFailureKind.conflict);
      expect(failure.isConflict, isTrue);
      expect(failure.isUncertain, isFalse);
    });

    test('falls back to the x-request-id header', () {
      final failure = ApiException.fromResponse(
        _response(
          status: 500,
          data: {
            'error': {'code': 'internal_error', 'message': 'Boom.'},
          },
          headers: {
            'x-request-id': ['req_header'],
          },
        ),
      );

      expect(failure.requestId, 'req_header');
      expect(failure.kind, ApiFailureKind.server);
      expect(failure.isUncertain, isTrue);
    });

    test('decodes a JSON string body', () {
      final failure = ApiException.fromResponse(
        _response(
          status: 422,
          data: '{"error":{"code":"validation_error","message":"Bad field."}}',
        ),
      );

      expect(failure.code, 'validation_error');
      expect(failure.kind, ApiFailureKind.validation);
      expect(failure.isValidation, isTrue);
    });

    test('maps status codes when the body is not an envelope', () {
      expect(
        ApiException.fromResponse(_response(status: 401)).kind,
        ApiFailureKind.unauthorized,
      );
      expect(
        ApiException.fromResponse(_response(status: 403)).kind,
        ApiFailureKind.forbidden,
      );
      expect(
        ApiException.fromResponse(_response(status: 404)).kind,
        ApiFailureKind.notFound,
      );
      expect(
        ApiException.fromResponse(_response(status: 429)).kind,
        ApiFailureKind.rateLimited,
      );
      expect(
        ApiException.fromResponse(_response(status: 418)).kind,
        ApiFailureKind.unknown,
      );
    });

    test('treats an idempotency conflict as a conflict even off 409', () {
      final failure = ApiException.fromResponse(
        _response(
          status: 422,
          data: {
            'error': {'code': 'idempotency_conflict', 'message': 'Key reused.'},
          },
        ),
      );

      expect(failure.kind, ApiFailureKind.conflict);
      expect(failure.isConflict, isTrue);
    });
  });

  group('ApiException.fromDio', () {
    DioException dio(DioExceptionType type, {Response<dynamic>? response}) =>
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/test'),
          type: type,
          response: response,
        );

    test(
      'marks timeouts, cancellations and dropped connections as uncertain',
      () {
        for (final type in [
          DioExceptionType.connectionTimeout,
          DioExceptionType.sendTimeout,
          DioExceptionType.receiveTimeout,
          DioExceptionType.cancel,
          DioExceptionType.connectionError,
        ]) {
          expect(
            ApiException.fromDio(dio(type)).isUncertain,
            isTrue,
            reason: '$type',
          );
        }
      },
    );

    test('a definitive business response is not uncertain', () {
      final failure = ApiException.fromDio(
        dio(
          DioExceptionType.badResponse,
          response: _response(
            status: 409,
            data: {
              'error': {'code': 'insufficient_stock', 'message': 'No.'},
            },
          ),
        ),
      );

      expect(failure.code, 'insufficient_stock');
      expect(failure.isUncertain, isFalse);
    });

    test('a network error without a response never becomes a server error', () {
      final failure = ApiException.fromDio(dio(DioExceptionType.unknown));

      expect(failure.kind, ApiFailureKind.network);
      expect(failure.code, 'network_error');
    });
  });
}
