import 'package:ebloods/core/constants/api_endpoints.dart';
import 'package:ebloods/core/network/api_client.dart';
import 'package:ebloods/features/notifications/data/models/notification_model.dart';

class NotificationsRepository {
  final ApiClient _apiClient = ApiClient();

  /// Get all notifications
  Future<List<NotificationModel>> getAllNotifications({String? userId}) async {
    final queryParams = <String, dynamic>{
      if (userId != null && userId.isNotEmpty) 'userId': userId,
    };

    final response = await _apiClient.request(
      ApiEndpoints.notifications,
      Method.get,
      queryParameters: queryParams,
    );

    if (response['success'] == true && response['data'] != null) {
      final data = response['data'];
      if (data is List) {
        return data
            .map((json) => NotificationModel.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    }

    return [];
  }

  /// Mark a notification as read
  Future<NotificationModel?> markAsRead(String notificationId) async {
    final response = await _apiClient.request(
      ApiEndpoints.markNotificationRead(notificationId),
      Method.post,
    );

    if (response['success'] == true && response['data'] != null) {
      return NotificationModel.fromJson(response['data'] as Map<String, dynamic>);
    }

    return null;
  }

  /// Mark all notifications as read
  Future<bool> markAllAsRead() async {
    final response = await _apiClient.request(
      ApiEndpoints.markAllNotificationsRead,
      Method.post,
    );

    return response['success'] == true;
  }

  /// Delete notification
  Future<bool> deleteNotification(String notificationId) async {
    final response = await _apiClient.request(
      ApiEndpoints.notificationById(notificationId),
      Method.delete,
    );

    return response['success'] == true;
  }
}
