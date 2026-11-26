import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/donors/data/models/donor_model.dart';

class DonorsRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get all donors
  Future<List<DonorModel>> getAllDonors({String? bloodGroup}) async {
    final uri = Uri.parse(
        '/api/donors/donors?'
        'bloodGroup=${bloodGroup ?? ''}');
    final response = await _apiClient.request(
      uri.path,
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      final List<dynamic> dataList = response['data'];
      return dataList
          .map((json) => DonorModel.fromJson(json))
          .toList();
    }

    return [];
  }

  /// Get donor by ID
  Future<DonorModel?> getDonorById(String donorId) async {
    final response = await _apiClient.request(
      '/api/donors/donors/$donorId',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      return DonorModel.fromJson(response['data']);
    }

    return null;
  }

  /// Create a new donor
  Future<DonorModel?> createDonor(DonorModel donor) async {
    final response = await _apiClient.request(
      '/api/donors/donors',
      Method.post,
      data: donor.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return DonorModel.fromJson(response['data']);
    }

    return null;
  }

  /// Update donor
  Future<DonorModel?> updateDonor(DonorModel donor) async {
    final response = await _apiClient.request(
      '/api/donors/donors/${donor.id}',
      Method.put,
      data: donor.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return DonorModel.fromJson(response['data']);
    }

    return null;
  }

  /// Delete donor
  Future<bool> deleteDonor(String donorId) async {
    final response = await _apiClient.request(
      '/api/donors/donors/$donorId',
      Method.delete,
      data: {},
    );

    return response['success'] == true;
  }
}