import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/blood_banks/data/models/blood_bank_model.dart';

class BloodBanksRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get all blood banks
  Future<List<BloodBankModel>> getAllBloodBanks({String? city, String? search}) async {
    final uri = Uri.parse(
        '/api/bloodbank/bloodbanks?'
        'city=${city ?? ''}'
        '&search=${search ?? ''}');
    final response = await _apiClient.request(
      uri.path,
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      final List<dynamic> dataList = response['data'];
      return dataList
          .map((json) => BloodBankModel.fromJson(json))
          .toList();
    }

    return [];
  }

  /// Get blood bank by ID
  Future<BloodBankModel?> getBloodBankById(String bankId) async {
    final response = await _apiClient.request(
      '/api/bloodbank/bloodbanks/$bankId',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodBankModel.fromJson(response['data']);
    }

    return null;
  }

  /// Create a new blood bank
  Future<BloodBankModel?> createBloodBank(BloodBankModel bloodBank) async {
    final response = await _apiClient.request(
      '/api/bloodbank/bloodbanks',
      Method.post,
      data: bloodBank.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodBankModel.fromJson(response['data']);
    }

    return null;
  }

  /// Update blood bank
  Future<BloodBankModel?> updateBloodBank(BloodBankModel bloodBank) async {
    final response = await _apiClient.request(
      '/api/bloodbank/bloodbanks/${bloodBank.id}',
      Method.put,
      data: bloodBank.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodBankModel.fromJson(response['data']);
    }

    return null;
  }

  /// Delete blood bank
  Future<bool> deleteBloodBank(String bankId) async {
    final response = await _apiClient.request(
      '/api/bloodbank/bloodbanks/$bankId',
      Method.delete,
      data: {},
    );

    return response['success'] == true;
  }
}