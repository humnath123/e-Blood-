import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/donors/data/donors_repository.dart';
import 'package:ebloods/features/donors/data/models/donor_model.dart';

class DonorsNotifier extends AsyncNotifier<List<DonorModel>> {
  late final DonorsRepository _repository;

  @override
  Future<List<DonorModel>> build() async {
    _repository = DonorsRepository();
    return _repository.getAllDonors();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllDonors());
  }

  Future<void> filterByBloodGroup(String? bloodGroup) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllDonors(bloodGroup: bloodGroup));
  }

  Future<DonorModel?> addDonor(DonorModel donor) async {
    final newDonor = await _repository.createDonor(donor);
    if (newDonor != null) {
      ref.invalidateSelf();
    }
    return newDonor;
  }

  Future<DonorModel?> updateDonor(DonorModel donor) async {
    final updated = await _repository.updateDonor(donor);
    if (updated != null) {
      ref.invalidateSelf();
    }
    return updated;
  }

  Future<bool> deleteDonor(String id) async {
    final success = await _repository.deleteDonor(id);
    if (success) {
      ref.invalidateSelf();
    }
    return success;
  }
}

final donorsProvider = AsyncNotifierProvider<DonorsNotifier, List<DonorModel>>(
  DonorsNotifier.new,
);
