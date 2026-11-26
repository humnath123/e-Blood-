import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/profile/data/models/profile_model.dart';
import 'package:ebloods/features/profile/data/profile_repository.dart';

class ProfileNotifier extends AsyncNotifier<ProfileModel?> {
  late final ProfileRepository _repository;

  @override
  Future<ProfileModel?> build() async {
    _repository = ProfileRepository();
    return _repository.getProfile();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getProfile());
  }

  Future<ProfileModel?> updateProfile(ProfileModel profile) async {
    final updated = await _repository.updateProfile(profile);
    if (updated != null) {
      state = AsyncValue.data(updated);
    }
    return updated;
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    return _repository.updatePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
  }
}

final profileProvider = AsyncNotifierProvider<ProfileNotifier, ProfileModel?>(
  ProfileNotifier.new,
);
