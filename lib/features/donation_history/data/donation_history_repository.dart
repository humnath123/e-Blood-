import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/donation_history/data/models/donation_history_model.dart';

class DonationHistoryRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get all donation history
  Future<List<DonationHistoryModel>> getAllDonationHistory() async {
    final response = await _apiClient.request(
      '/donations/donations',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      final List<dynamic> dataList = response['data'];
      return dataList
          .map((json) => DonationHistoryModel.fromJson(json))
          .toList();
    }

    return [];
  }

  /// Get donation history by ID
  Future<DonationHistoryModel?> getDonationHistoryById(String id) async {
    final response = await _apiClient.request(
      '/donations/donations/$id',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      return DonationHistoryModel.fromJson(response['data']);
    }

    return null;
  }

  /// Create a new donation history
  Future<DonationHistoryModel?> createDonationHistory(DonationHistoryModel donationHistory) async {
    final response = await _apiClient.request(
      '/donations/donations',
      Method.post,
      data: donationHistory.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return DonationHistoryModel.fromJson(response['data']);
    }

    return null;
  }

  /// Update donation history
  Future<DonationHistoryModel?> updateDonationHistory(String id, DonationHistoryModel donationHistory) async {
    final response = await _apiClient.request(
      '/donations/donations/$id',
      Method.put,
      data: donationHistory.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return DonationHistoryModel.fromJson(response['data']);
    }

    return null;
  }

  /// Delete donation history
  Future<bool> removeDonationHistory(String id) async {
    final response = await _apiClient.request(
      '/donations/donations/$id',
      Method.delete,
      data: {},
    );

    return response['success'] == true;
  }
}