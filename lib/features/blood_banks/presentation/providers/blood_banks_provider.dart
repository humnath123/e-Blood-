import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/features/blood_banks/data/blood_banks_repository.dart';
import 'package:ebloods/features/blood_banks/data/models/blood_bank_model.dart';

class BloodBanksNotifier extends AsyncNotifier<List<BloodBankModel>> {
  late final BloodBanksRepository _repository;

  @override
  Future<List<BloodBankModel>> build() async {
    _repository = BloodBanksRepository();
    return _repository.getAllBloodBanks();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _repository.getAllBloodBanks());
  }

  Future<void> searchBloodBanks({String? city, String? search}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => _repository.getAllBloodBanks(city: city, search: search),
    );
  }

  Future<BloodBankModel?> addBloodBank(BloodBankModel bloodBank) async {
    final newBank = await _repository.createBloodBank(bloodBank);
    if (newBank != null) {
      ref.invalidateSelf();
    }
    return newBank;
  }

  Future<BloodBankModel?> updateBloodBank(BloodBankModel bloodBank) async {
    final updated = await _repository.updateBloodBank(bloodBank);
    if (updated != null) {
      ref.invalidateSelf();
    }
    return updated;
  }

  Future<bool> deleteBloodBank(String bankId) async {
    final success = await _repository.deleteBloodBank(bankId);
    if (success) {
      ref.invalidateSelf();
    }
    return success;
  }
}

final bloodBanksProvider =
    AsyncNotifierProvider<BloodBanksNotifier, List<BloodBankModel>>(
  BloodBanksNotifier.new,
);
