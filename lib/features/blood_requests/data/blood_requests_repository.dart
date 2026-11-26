import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/blood_requests/data/models/blood_request_model.dart';

class BloodRequestsRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get all blood requests
  Future<List<BloodRequestModel>> getAllBloodRequests(
      {String? status, String? bloodGroup, String? urgency}) async {
    final uri = Uri.parse(
        '/api/bloodrequests/bloodrequests?'
        'status=${status ?? ''}'
        '&bloodGroup=${bloodGroup ?? ''}'
        '&urgency=${urgency ?? ''}');
    final response = await _apiClient.request(
      uri.path,
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      final List<dynamic> dataList = response['data'];
      return dataList
          .map((json) => BloodRequestModel.fromJson(json))
          .toList();
    }

    return [];
  }

  /// Get blood request by ID
  Future<BloodRequestModel?> getBloodRequestById(String requestId) async {
    final response = await _apiClient.request(
      '/api/bloodrequests/bloodrequests/$requestId',
      Method.get,
      data: {},
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodRequestModel.fromJson(response['data']);
    }

    return null;
  }

  /// Create a new blood request
  Future<BloodRequestModel?> createBloodRequest(BloodRequestModel bloodRequest) async {
    final response = await _apiClient.request(
      '/api/bloodrequests/bloodrequests',
      Method.post,
      data: bloodRequest.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodRequestModel.fromJson(response['data']);
    }

    return null;
  }

  /// Update blood request
  Future<BloodRequestModel?> updateBloodRequest(String requestId, BloodRequestModel bloodRequest) async {
    final response = await _apiClient.request(
      '/api/bloodrequests/bloodrequests/$requestId',
      Method.put,
      data: bloodRequest.toJson(),
    );

    if (response['success'] == true && response['data'] != null) {
      return BloodRequestModel.fromJson(response['data']);
    }

    return null;
  }

  /// Delete blood request
  Future<bool> deleteBloodRequest(String requestId) async {
    final response = await _apiClient.request(
      '/api/bloodrequests/bloodrequests/$requestId',
      Method.delete,
      data: {},
    );

    return response['success'] == true;
  }
}