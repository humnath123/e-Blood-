import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/blood_requests/data/blood_requests_repository.dart';
import 'package:ebloods/features/blood_requests/data/models/blood_request_model.dart';

class BloodRequestsNotifier extends AsyncNotifier<List<BloodRequestModel>> {
  late final BloodRequestsRepository _repository;

  @override
  Future<List<BloodRequestModel>> build() async {
    _repository = BloodRequestsRepository();
    return _repository.getAllBloodRequests();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllBloodRequests());
  }

  Future<void> filterRequests({String? status, String? bloodGroup, String? urgency}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllBloodRequests(
          status: status,
          bloodGroup: bloodGroup,
          urgency: urgency,
        ));
  }

  Future<BloodRequestModel?> addBloodRequest(BloodRequestModel bloodRequest) async {
    final newRequest = await _repository.createBloodRequest(bloodRequest);
    if (newRequest != null) {
      ref.invalidateSelf();
    }
    return newRequest;
  }

  Future<BloodRequestModel?> updateBloodRequest(
      String requestId, BloodRequestModel bloodRequest) async {
    final updated = await _repository.updateBloodRequest(requestId, bloodRequest);
    if (updated != null) {
      ref.invalidateSelf();
    }
    return updated;
  }

  Future<bool> deleteBloodRequest(String requestId) async {
    final success = await _repository.deleteBloodRequest(requestId);
    if (success) {
      ref.invalidateSelf();
    }
    return success;
  }
}

final bloodRequestsProvider =
    AsyncNotifierProvider<BloodRequestsNotifier, List<BloodRequestModel>>(
  BloodRequestsNotifier.new,
);
