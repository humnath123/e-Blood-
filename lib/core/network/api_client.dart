import 'package:dio/dio.dart';
import 'package:ebloods/core/constants/api_endpoints.dart';
import 'package:ebloods/core/storage/local_storage.dart';

enum Method { get, post, put, patch, delete }

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  final Dio _dio = Dio();
  final LocalStorage _localStorage = LocalStorage();
  void Function()? onUnauthorized;

  ApiClient._internal() {
    _dio.options.baseUrl = ApiEndpoints.baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 60);
    _dio.options.receiveTimeout = const Duration(seconds: 60);
    _dio.options.sendTimeout = const Duration(seconds: 60);
    _dio.options.headers['Content-Type'] = 'application/json';

    if (ApiEndpoints.apiKey.isNotEmpty) {
      _dio.options.headers['x-api-key'] = ApiEndpoints.apiKey;
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _localStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          if (ApiEndpoints.apiKey.isNotEmpty) {
            options.headers['x-api-key'] = ApiEndpoints.apiKey;
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            await _localStorage.clearAll();
            onUnauthorized?.call();
          }
          return handler.next(e);
        },
      ),
    );
  }

  /// Ping health endpoint on startup to wake up Render free tier container
  static Future<void> wakeServer() async {
    try {
      await _instance._dio.get('/health').timeout(const Duration(seconds: 5));
    } catch (_) {
      // Ignore wake-up errors
    }
  }

  Future<Map<String, dynamic>> request(
    String path,
    Method method, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      Response response;
      switch (method) {
        case Method.get:
          response = await _dio.get(path, queryParameters: queryParameters, options: options);
          break;
        case Method.post:
          response = await _dio.post(path, data: data, queryParameters: queryParameters, options: options);
          break;
        case Method.put:
          response = await _dio.put(path, data: data, queryParameters: queryParameters, options: options);
          break;
        case Method.patch:
          response = await _dio.patch(path, data: data, queryParameters: queryParameters, options: options);
          break;
        case Method.delete:
          response = await _dio.delete(path, data: data, queryParameters: queryParameters, options: options);
          break;
      }

      if (response.data is Map) {
        final resMap = Map<String, dynamic>.from(response.data as Map);
        if (resMap.containsKey('success')) {
          final bool isSuccess = resMap['success'] == true;
          return {
            'success': isSuccess,
            'data': isSuccess ? (resMap['data'] ?? resMap) : null,
            'message': resMap['message']?.toString() ?? (isSuccess ? '' : 'Request failed'),
          };
        }
      }

      return {
        'success': true,
        'data': response.data,
        'message': '',
      };
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _localStorage.clearAll();
        onUnauthorized?.call();
        return {
          'success': false,
          'data': null,
          'message': 'Session expired. Please log in again.',
        };
      }

      String message = 'Network error occurred. (Server waking up on Render)';

      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        message = 'Server is waking up from Render cold start. Please try again in 30 seconds.';
      } else if (e.response != null && e.response!.statusCode != null && e.response!.statusCode! >= 400) {
        if (e.response?.data is Map) {
          final errMap = Map<String, dynamic>.from(e.response!.data as Map);
          message = errMap['message']?.toString() ?? errMap['error']?.toString() ?? 'Request failed (${e.response!.statusCode})';
        } else if (e.response?.data != null) {
          message = e.response!.data.toString();
        } else {
          message = 'Request failed with status ${e.response!.statusCode}';
        }
      } else {
        if (e.response?.data is Map) {
          final errMap = Map<String, dynamic>.from(e.response!.data as Map);
          message = errMap['message']?.toString() ?? e.message ?? 'Connection error';
        } else if (e.response?.data != null) {
          message = e.response!.data.toString();
        } else if (e.message != null && e.message!.isNotEmpty) {
          message = e.message!;
        } else {
          message = 'Connection error';
        }
      }

      return {
        'success': false,
        'data': null,
        'message': message,
      };
    } catch (e) {
      return {
        'success': false,
        'data': null,
        'message': e.toString(),
      };
    }
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String username,
    required String firstName,
    required String lastName,
    required String password,
    String? phone,
    String? age,
    String? role,
  }) async {
    return request(
      ApiEndpoints.register,
      Method.post,
      data: {
        'email': email,
        'username': username,
        'firstName': firstName,
        'lastName': lastName,
        'first_name': firstName,
        'last_name': lastName,
        'password': password,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (age != null && age.isNotEmpty) 'age': age,
        if (role != null && role.isNotEmpty) 'role': role,
      },
    );
  }

  Future<Map<String, dynamic>> forgotPassword({
    required String email,
    String? phone,
  }) async {
    return request(
      ApiEndpoints.forgotPassword,
      Method.post,
      data: {
        if (email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      },
    );
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String password,
    required String confirmPassword,
  }) async {
    return request(
      ApiEndpoints.resetPassword,
      Method.post,
      data: {
        'email': email,
        'otp': otp,
        'password': password,
        'confirmPassword': confirmPassword,
      },
    );
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    return request(
      ApiEndpoints.login,
      Method.post,
      data: {
        'email': email,
        'identifier': email,
        'username': email,
        'password': password,
      },
    );
  }
}
