import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/auth/data/models/user_model.dart';

class AuthRepository {
  final ApiClient _apiClient = ApiClient();

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    return _apiClient.login(
      email: email,
      password: password,
    );
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
    return _apiClient.register(
      email: email,
      username: username,
      firstName: firstName,
      lastName: lastName,
      password: password,
      phone: phone,
      age: age,
      role: role,
    );
  }

  Future<Map<String, dynamic>> forgotPassword({
    required String email,
    String? phone,
  }) async {
    return _apiClient.forgotPassword(
      email: email,
      phone: phone,
    );
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String password,
    required String confirmPassword,
  }) async {
    return _apiClient.resetPassword(
      email: email,
      otp: otp,
      password: password,
      confirmPassword: confirmPassword,
    );
  }

  Future<UserModel?> getMe() async {
    final response = await _apiClient.request(
      '/auth/me',
      Method.get,
    );
    if (response['success'] == true && response['data'] != null) {
      return UserModel.fromJson(response['data'] as Map<String, dynamic>);
    }
    return null;
  }
}
