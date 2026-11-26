import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/storage/local_storage.dart';
import 'package:ebloods/features/auth/data/auth_repository.dart';
import 'package:ebloods/features/auth/data/models/user_model.dart';
import 'package:ebloods/features/auth/presentation/providers/auth_state.dart';

class AuthNotifier extends Notifier<AuthState> {
  late final AuthRepository _authRepository;
  late final LocalStorage _localStorage;

  @override
  AuthState build() {
    _authRepository = AuthRepository();
    _localStorage = LocalStorage();
    _loadStoredToken();
    return const AuthState.initial();
  }

  Future<void> _loadStoredToken() async {
    final token = await _localStorage.getToken();
    final userJson = await _localStorage.getUserJson();

    if (token != null && token.isNotEmpty && userJson != null && userJson.isNotEmpty) {
      try {
        final userModel = UserModel.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
        state = AuthState.authenticated(userModel, token);
      } catch (_) {
        await _localStorage.clearAll();
        state = const AuthState.unauthenticated();
      }
    } else {
      state = const AuthState.unauthenticated();
    }
  }

  Future<bool> register({
    required String email,
    required String username,
    required String firstName,
    required String lastName,
    required String password,
    String? phone,
    String? role,
  }) async {
    state = const AuthState.loading();
    final response = await _authRepository.register(
      email: email,
      username: username,
      firstName: firstName,
      lastName: lastName,
      password: password,
      phone: phone,
      role: role,
    );

    if (response['success'] == true && response['data'] != null) {
      final data = response['data'] as Map<String, dynamic>;
      final token = data['token']?.toString() ?? '';
      final userData = data.containsKey('user')
          ? data['user']
          : (data.containsKey('userModel') ? data['userModel'] : data);

      final user = UserModel.fromJson(userData as Map<String, dynamic>);
      await _saveSession(token, user);
      state = AuthState.authenticated(user, token);
      return true;
    } else {
      final message = response['message']?.toString() ?? 'Registration failed';
      state = AuthState.unauthenticated(message);
      return false;
    }
  }

  Future<bool> login({
    required String identifier,
    required String password,
  }) async {
    state = const AuthState.loading();
    final response = await _authRepository.login(
      identifier: identifier,
      password: password,
    );

    if (response['success'] == true && response['data'] != null) {
      final data = response['data'] as Map<String, dynamic>;
      final token = data['token']?.toString() ?? '';
      final userData = data.containsKey('user')
          ? data['user']
          : (data.containsKey('userModel') ? data['userModel'] : data);

      final user = UserModel.fromJson(userData as Map<String, dynamic>);
      await _saveSession(token, user);
      state = AuthState.authenticated(user, token);
      return true;
    } else {
      final message = response['message']?.toString() ?? 'Login failed';
      state = AuthState.unauthenticated(message);
      return false;
    }
  }

  Future<void> logout() async {
    await _localStorage.clearAll();
    state = const AuthState.unauthenticated();
  }

  Future<bool> forgotPassword({
    required String email,
    String? phone,
  }) async {
    state = const AuthState.loading();
    final response = await _authRepository.forgotPassword(
      email: email,
      phone: phone,
    );

    if (response['success'] == true) {
      state = const AuthState.unauthenticated();
      return true;
    } else {
      final message = response['message']?.toString() ?? 'Failed to send reset link';
      state = AuthState.unauthenticated(message);
      return false;
    }
  }

  Future<bool> resetPassword({
    required String email,
    required String otp,
    required String password,
    required String confirmPassword,
  }) async {
    state = const AuthState.loading();
    final response = await _authRepository.resetPassword(
      email: email,
      otp: otp,
      password: password,
      confirmPassword: confirmPassword,
    );

    if (response['success'] == true) {
      await logout();
      return true;
    } else {
      final message = response['message']?.toString() ?? 'Failed to reset password';
      state = AuthState.unauthenticated(message);
      return false;
    }
  }

  Future<void> _saveSession(String token, UserModel user) async {
    await _localStorage.saveToken(token);
    await _localStorage.saveUserJson(jsonEncode(user.toJson()));
  }

  void clearError() {
    if (state.error != null) {
      state = state.copyWith(error: null);
    }
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
