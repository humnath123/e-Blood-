import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/profile/data/models/profile_model.dart';

class ProfileRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get profile
  Future<ProfileModel> getProfile() async {
    final response = await _apiClient.request(
      '/profile/profile',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      return ProfileModel.fromJson(response['data']);
    }

    throw Exception('Failed to load profile');
  }

  /// Update profile
  Future<ProfileModel?> updateProfile(ProfileModel profile) async {
    final response = await _apiClient.request(
      '/profile/profile',
      Method.put,
      data: profile.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return ProfileModel.fromJson(response['data']);
    }

    return null;
  }

  /// Update password
  Future<bool> updatePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _apiClient.request(
      '/profile/password',
      Method.put,
      data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );

    return response['success'] == true;
  }
}