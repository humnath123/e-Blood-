import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/donation_history/data/donation_history_repository.dart';
import 'package:ebloods/features/donation_history/data/models/donation_history_model.dart';

class DonationHistoryNotifier extends AsyncNotifier<List<DonationHistoryModel>> {
  late final DonationHistoryRepository _repository;

  @override
  Future<List<DonationHistoryModel>> build() async {
    _repository = DonationHistoryRepository();
    return _repository.getAllDonationHistory();
  }

  Future<void> refresh({String? donorId}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllDonationHistory());
  }

  Future<DonationHistoryModel?> addDonation(DonationHistoryModel donation) async {
    final created = await _repository.createDonationHistory(donation);
    if (created != null) {
      ref.invalidateSelf();
    }
    return created;
  }

  Future<DonationHistoryModel?> updateDonation(
      String donationId, DonationHistoryModel donation) async {
    final updated = await _repository.updateDonationHistory(donationId, donation);
    if (updated != null) {
      ref.invalidateSelf();
    }
    return updated;
  }
}

final donationHistoryProvider =
    AsyncNotifierProvider<DonationHistoryNotifier, List<DonationHistoryModel>>(
  DonationHistoryNotifier.new,
);