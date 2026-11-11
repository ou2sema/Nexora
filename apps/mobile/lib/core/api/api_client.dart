import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Headers;
import 'package:uuid/uuid.dart';

import '../errors/api_exception.dart';

class DownloadedFile {
  const DownloadedFile({
    required this.bytes,
    required this.filename,
    this.contentType,
  });

  final Uint8List bytes;
  final String filename;
  final String? contentType;
}

/// The single HTTP entry point. Every call carries the Supabase bearer token, a
/// correlation id, a bounded timeout and an optional cancel token. Mutations
/// pass the idempotency key the caller keeps across retries.
class ApiClient {
  ApiClient({required String apiBaseUrl, required this._supabase})
    : _dio = Dio(
        BaseOptions(
          // Dio concatenates baseUrl and path verbatim, so the base needs its
          // trailing slash or `me` would become `/api/v1me`.
          baseUrl: apiBaseUrl.endsWith('/') ? apiBaseUrl : '$apiBaseUrl/',
          connectTimeout: const Duration(seconds: 20),
          sendTimeout: const Duration(seconds: 30),
          // A free Render instance wakes in about 30-50 s after idling, so the
          // first call of the day must be allowed to outlast that.
          receiveTimeout: const Duration(seconds: 75),
          headers: const {'accept': 'application/json'},
          responseType: ResponseType.json,
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _supabase.auth.currentSession?.accessToken;
          if (token == null || token.isEmpty) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.badResponse,
                response: Response<dynamic>(
                  requestOptions: options,
                  statusCode: 401,
                  data: const {
                    'error': {
                      'code': 'unauthorized',
                      'message': 'No active session.',
                    },
                  },
                ),
              ),
            );
            return;
          }
          options.headers['authorization'] = 'Bearer $token';
          options.headers['x-request-id'] ??= const Uuid().v4();
          handler.next(options);
        },
      ),
    );
    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(
          request: false,
          requestHeader: false,
          requestBody: false,
          responseHeader: false,
          responseBody: false,
          logPrint: (line) => debugPrint('[api] $line'),
        ),
      );
    }
    // Build-time switch, so the timing interceptor costs nothing in release.
    if (const bool.fromEnvironment('PERF_LOG')) {
      _dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            options.extra['perf.start'] = DateTime.now().microsecondsSinceEpoch;
            handler.next(options);
          },
          onResponse: (response, handler) {
            _logTiming(response.requestOptions, 'ok');
            handler.next(response);
          },
          onError: (error, handler) {
            _logTiming(
              error.requestOptions,
              'err${error.response?.statusCode ?? ''}',
            );
            handler.next(error);
          },
        ),
      );
    }
  }

  static void _logTiming(RequestOptions options, String outcome) {
    final start = options.extra['perf.start'] as int?;
    if (start == null) return;
    final elapsed = (DateTime.now().microsecondsSinceEpoch - start) ~/ 1000;
    debugPrint(
      '[perf] ${options.method} ${options.uri.host}${options.uri.path} '
      '$outcome ${elapsed}ms',
    );
  }

  final SupabaseClient _supabase;
  final Dio _dio;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) => _json<T>(
    () => _dio.get<dynamic>(
      path,
      queryParameters: _clean(query),
      cancelToken: cancelToken,
    ),
  );

  Future<T> post<T>(
    String path, {
    Object? body,
    String? idempotencyKey,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) => _json<T>(
    () => _dio.post<dynamic>(
      path,
      data: body,
      queryParameters: _clean(query),
      cancelToken: cancelToken,
      options: _mutationOptions(idempotencyKey),
    ),
  );

  Future<T> patch<T>(
    String path, {
    Object? body,
    String? idempotencyKey,
    CancelToken? cancelToken,
  }) => _json<T>(
    () => _dio.patch<dynamic>(
      path,
      data: body,
      cancelToken: cancelToken,
      options: _mutationOptions(idempotencyKey),
    ),
  );

  Future<T> put<T>(
    String path, {
    Object? body,
    String? idempotencyKey,
    CancelToken? cancelToken,
  }) => _json<T>(
    () => _dio.put<dynamic>(
      path,
      data: body,
      cancelToken: cancelToken,
      options: _mutationOptions(idempotencyKey),
    ),
  );

  Future<void> delete(
    String path, {
    String? idempotencyKey,
    Object? body,
    CancelToken? cancelToken,
  }) async {
    try {
      await _dio.delete<dynamic>(
        path,
        data: body,
        cancelToken: cancelToken,
        options: _mutationOptions(idempotencyKey),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<T> putBytes<T>(
    String path,
    Uint8List bytes, {
    required String contentType,
    CancelToken? cancelToken,
  }) => _json<T>(
    () => _dio.put<dynamic>(
      path,
      data: bytes,
      cancelToken: cancelToken,
      options: Options(
        contentType: contentType,
        headers: {'content-length': bytes.length},
      ),
    ),
  );

  /// A POST whose answer is a file, such as a label sheet built from a request body.
  Future<DownloadedFile> postBytes(
    String path, {
    Object? body,
    required String fallbackFilename,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.post<List<int>>(
        path,
        data: body,
        cancelToken: cancelToken,
        options: Options(
          contentType: Headers.jsonContentType,
          responseType: ResponseType.bytes,
        ),
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException(
          kind: ApiFailureKind.server,
          code: 'empty_document',
          message: 'The document came back empty.',
        );
      }
      return DownloadedFile(
        bytes: Uint8List.fromList(data),
        filename:
            filenameFrom(response.headers.value('content-disposition')) ??
            fallbackFilename,
        contentType: response.headers.value('content-type'),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<DownloadedFile> download(
    String path, {
    required String fallbackFilename,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) async {
    try {
      final response = await _dio.get<List<int>>(
        path,
        queryParameters: _clean(query),
        cancelToken: cancelToken,
        options: Options(responseType: ResponseType.bytes),
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException(
          kind: ApiFailureKind.server,
          code: 'empty_document',
          message: 'The document came back empty.',
        );
      }
      return DownloadedFile(
        bytes: Uint8List.fromList(data),
        filename:
            filenameFrom(response.headers.value('content-disposition')) ??
            fallbackFilename,
        contentType: response.headers.value('content-type'),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  static String? filenameFrom(String? disposition) {
    if (disposition == null) return null;
    final utf8Match = RegExp(
      r"filename\*=UTF-8''([^;]+)",
      caseSensitive: false,
    ).firstMatch(disposition);
    if (utf8Match != null) {
      return Uri.decodeComponent(utf8Match.group(1)!);
    }
    final plain = RegExp(
      r'filename="?([^";]+)"?',
      caseSensitive: false,
    ).firstMatch(disposition);
    return plain?.group(1);
  }

  Options _mutationOptions(String? idempotencyKey) => Options(
    contentType: Headers.jsonContentType,
    headers: {'idempotency-key': ?idempotencyKey},
  );

  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final result = <String, dynamic>{};
    for (final entry in query.entries) {
      if (entry.value != null) result[entry.key] = entry.value;
    }
    return result.isEmpty ? null : result;
  }

  Future<T> _json<T>(Future<Response<dynamic>> Function() send) async {
    try {
      final response = await send();
      final data = response.data;
      if (data == null) return null as T;
      return data as T;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    } on TypeError {
      throw const ApiException(
        kind: ApiFailureKind.unknown,
        code: 'unexpected_payload',
        message: 'The server returned an unexpected payload.',
      );
    }
  }
}
